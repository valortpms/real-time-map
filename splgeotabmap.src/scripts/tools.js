/* eslint-disable no-unused-vars */

/**********************************************************************************
 * Register these Add-In Event Handlers with Geotab Map API on APP Load
 */
const onLoadInitEvents = function (my) {

  // Event: User moves mouse OVER a Vehicle on the map
  my.service.events.attach("over", (evt) => {
    if (evt.type === "device") {
      my.service.api
        .call("Get", {
          typeName: "Device",
          search: { id: evt.entity.id },
        })
        .then(function (result) {
          if (result[0]) {
            const vehObj = result[0];
            my.ui.showTooltip(evt.entity.id, vehObj.name);
            my.app.monitorVehSensorDataStatus();
          }
          //
          else {
            console.log(`--- VehId [ ${evt.entity.id} ] Location could not be found!`);
          }
        });
    }
  });

  // Event: User moves mouse OFF a Vehicle on the map
  my.service.events.attach("out", (evt) => {
    // Remove this Vehicle from ToolTip registry to disable update attempt by the uiUpdateService
    if (evt.type === "device" && my.storage.sensorData.vehRegistry.tooltip === evt.entity.id) {
      my.storage.sensorData.vehRegistry.tooltip = "";
    }
  });

  // Event: User focuses on SplMap Deeper add-in (Show What I Know)
  my.service.page.attach("focus", () => {
    console.log("--- Focus Occured");
    // Don't LOAD if SAVE operation is Pending
    if (my.localStore.isSavePending()) {
      my.app.init();
    }
    else {
      my.localStore.load(() => {
        my.app.init();
      });
    }
  });

  // Event: User focuses away from SplMap Deeper add-in (may not trigger on MyGeotab page switch)
  my.service.page.attach("blur", () => {
    console.log("--- Blur Occured");
    // Cancel all Pending Tasks in App
    my.app.cancelPendingTasks();
  });

  // Event: The state of the page has changed
  my.service.page.attach("stateChange", (evt) => {
    console.log("--- StateChange Occured", JSON.stringify(evt));
  });

  // Create handler for dynamic closeMenuItem() button 'click' event
  document.addEventListener("click", function (evt) {
    if (evt.target && evt.target.classList.contains("vehDetailClose")) {
      const vehIdAttrName = "data-veh-id";
      const vehId = evt.target.getAttribute(vehIdAttrName) !== null ? evt.target.getAttribute(vehIdAttrName) : "";
      my.ui.closeMenuItem(vehId);
    }
  });

  // Monitor resizing of parent window width
  window.addEventListener("resize", () => my.app.windowWidthMonitor());

  // Event: Reset Button clicked
  my.resetBtnElemObj.addEventListener("click", () => {
    my.app.resetApp();
  });
};

/**********************************************************************************
 * Register these Add-In Event Handlers with Geotab Map API after TR initialization
 */
const loadInitEventsPostTr = function (my) {

  // Register these events once on page load
  if (!document.body.getAttribute("splgeotabmap")) {

    // Register Vehicle Menu-Item "Show SpartanLync Sensors" on map
    my.service.actionList.attachMenu("vehicleMenu", (_, rest) => {
      return Promise.resolve([
        {
          title: my.tr("map_menuitm_label"),
          icon: my.toolTipSettings.cfg.icon,
          clickEvent: "ShowSplDeviceInfo",
          data: rest.device,
        },
      ]);
    });

    // Register Vehicle Menu-Item "Add/Remove to/from SpartanLync Watchlist" on map
    my.service.actionList.attachMenu("vehicleMenu", (_, rest) => {
      const title = my.app.getWatchlistByIds().includes(rest.device.id) ? my.tr("map_menuitm_watchlist_remove") : my.tr("map_menuitm_watchlist_add");
      return Promise.resolve([
        {
          title: title,
          icon: my.watchlistAndAlertSettings.mapVehMenuItemIcon,
          clickEvent: "ToggleSplWatchList",
          data: rest.device,
        },
      ]);
    });

    // Event: Clicked "Show SpartanLync Sensors" Menu-Item on Vehicle map
    my.service.actionList.attach("ShowSplDeviceInfo", vehObj => {
      const vehId = vehObj.id;
      if (vehId) {
        if (my.app.getWatchlistByIds().includes(vehId)) {
          my.app.monitorVehSensorDataStatus();
        }
        else {
          my.service.api
            .call("Get", {
              typeName: "Device",
              search: { id: vehId },
            })
            .then(function (result) {
              if (result[0]) {
                const vehObj = result[0];

                // Update watchlist & show in UI
                my.app.addWatchlistItem(vehId, vehObj.name);
                my.app.monitorVehSensorDataStatus();

                // SAVE watchlist change Locally & Remotely
                my.app.saveWatchlist("NOW");
              }
            });
        }
      }
    });

    // Event: Clicked "Show SpartanLync Sensors" Menu-Item on Vehicle map
    my.service.actionList.attach("ToggleSplWatchList", vehObj => {
      const vehId = vehObj.id;
      if (vehId) {
        my.service.api
          .call("Get", {
            typeName: "Device",
            search: { id: vehId },
          })
          .then(function (result) {
            if (result[0]) {
              const vehObj = result[0];

              // Update Watchlist by Adding/Deleting
              if (my.app.getWatchlistByIds().includes(vehId)) {
                my.app.delWatchlistItem(vehId);

                // Remove vehId from Panel Jumper Widget
                my.ui.panelVehJumper.del(vehId);
              }
              else {
                my.app.addWatchlistItem(vehId, vehObj.name);
              }
              my.app.monitorVehSensorDataStatus();

              // SAVE watchlist change Locally & Remotely
              my.app.saveWatchlist("NOW");
            }
          });
      }
    });

    // Set <body splgeotabmap="eventsok"> attribute as flag indicating initialization completed
    document.body.setAttribute("splgeotabmap", "eventsok");
  }
};

/**********************************************************************************
 * App data storage and backup routines
 */
const InitLocalStorage = function (my, storageKeyId, storageSecret) {

  /**
   *  Private Variables
   */
  this._my = null;
  this._storageKey = "";
  this._storageSecret = "";
  this._callback = null;

  // queue up multiple save requests into a single save() operation
  this._setTimerHandle = null;
  this._setWaitTime = 5000;    // Time to wait before performing the save() operation

  /**
   *  Encrypt sensitive storage data and Save all of storage to localStorage
   *  @param {data} data The data object
   */
  this.save = function (callback) {
    const me = this;
    const my = me._my;
    const storageCfgKey = me._storageKey + "_CFG";
    const storageCacheKey = me._storageKey + "_CACHE";
    const saveWaitTime = typeof callback === "string" && callback.toUpperCase() === "NOW" ? 0 : me._setWaitTime;
    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    // Wait till activity settles down
    if (me._setTimerHandle === null) {
      me._setTimerHandle = setTimeout(function () {

        // Encrypt everything but /sensorData property
        const dataBak = JSON.parse(JSON.stringify(my.storage)); // clone storage object... can't modify the original
        delete dataBak.sensorData;
        const encryptedStorageCfgObj = sjcl.encrypt(me._storageSecret, JSON.stringify(dataBak));
        const unencryptedSensorDataObj = JSON.stringify(my.storage.sensorData);

        localStorage.setItem(storageCfgKey, encryptedStorageCfgObj);
        localStorage.setItem(storageCacheKey, unencryptedSensorDataObj);

        console.log("--- Successfully Saved data to Local Storage");
        if (me._callback) {
          me._callback(); // Invoke callback if provided
          me._callback = null;
        }
        me._setTimerHandle = null;
      }, saveWaitTime);
    }
  };

  /**
   *  Get encrypted storage data from localStorage, then decrypt the encryted parts and restore the whole
   *  @return {*} An object with a property as JS object
   */
  this.load = function (callback) {
    const me = this;
    const my = me._my;
    const storageCfgKey = me._storageKey + "_CFG";
    const storageCacheKey = me._storageKey + "_CACHE";
    const encryptedStorageCfgObj = me.parseJSON(localStorage.getItem(storageCfgKey));
    const unencryptedSensorDataObj = me.parseJSON(localStorage.getItem(storageCacheKey));
    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    // Storage data is paired, so both must exist
    if (typeof encryptedStorageCfgObj !== "undefined" && encryptedStorageCfgObj !== null &&
      typeof encryptedStorageCfgObj === "object" && typeof encryptedStorageCfgObj.cipher !== "undefined" &&
      typeof unencryptedSensorDataObj !== "undefined" && unencryptedSensorDataObj !== null &&
      typeof unencryptedSensorDataObj === "object" && typeof unencryptedSensorDataObj.cache !== "undefined") {

      // Decrypt & Save
      my.storage = JSON.parse(sjcl.decrypt(me._storageSecret, JSON.stringify(encryptedStorageCfgObj)));
      my.storage.sensorData = unencryptedSensorDataObj;

      // Set Sensor Data Cache
      my.sdataTools._cache = my.storage.sensorData.cache;
      console.log("--- Successfully restored data from Local Storage: ");
    }
    // Delete one if the other is missing
    else {
      if (typeof encryptedStorageCfgObj !== "undefined" && encryptedStorageCfgObj !== null) {
        localStorage.removeItem(storageCfgKey);
      }
      if (typeof unencryptedSensorDataObj !== "undefined" && unencryptedSensorDataObj !== null) {
        localStorage.removeItem(storageCacheKey);
      }
      console.log("--- Local Storage Empty");
    }
    if (me._callback) {
      me._callback(my.storage); // Invoke callback if provided
      me._callback = null;
    }
  };

  /**
   *  Clears all Add-In data from localStorage
   */
  this.clear = function (callback) {
    const me = this;
    const my = me._my;
    const storageCfgKey = me._storageKey + "_CFG";
    const storageCacheKey = me._storageKey + "_CACHE";
    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    localStorage.removeItem(storageCfgKey);
    localStorage.removeItem(storageCacheKey);
    console.log("--- Successful purged data from Local Storage");

    if (me._callback) {
      me._callback(); // Invoke callback if provided
      me._callback = null;
    }
  };

  /**
  *  Report on pending SAVE operation
  *
  * @return boolean
  */
  this.isSavePending = function () {
    const me = this;
    return me._setTimerHandle === null ? false : true;
  };

  /**
  *  Parse JSON String to JSON Object
  *
  * @return object (NULL on invalid JSON / Parsing Error)
  */
  this.parseJSON = function (raw) {
    try {
      json = JSON.parse(raw);
    } catch (e) {
      // Malformed JSON
      return null;
    }
    return json;
  };

  this.configure = function (my, storageKeyId, storageSecret) {
    const me = this;
    me._my = my;
    me._storageKey = storageKeyId;
    me._storageSecret = storageSecret;
  };

  // configure when an instance gets created
  this.configure(my, storageKeyId, storageSecret);
};

/**********************************************************************************
 * App opertion utilities
 */
const SplGeotabMapUtils = function (my) {
  return function () {
    const me = {

      /**
       *  Private Variables
       */
      _callback: null,

      /**
       * init() Initialization tasks for SplGeotabMap Add-in
       *
       * @return void
       */
      init: function (callback) {
        me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;
        my.ui.init(() => {
          const now = moment().utc().unix();
          const cachedStoreExpiry = my.storage.splStoreFetchedUnix ? moment.unix(my.storage.splStoreFetchedUnix).add(my.storeLifetime, "seconds").unix() : now;

          // Refresh SplService configuration(s) if:
          // 1. Missing
          // 2. Stale (older than expiry date as defined in "cachedStoreLifetime" setting)
          //
          if (!my.storage.credentials.sessionId ||
            !my.storage.splStore ||
            cachedStoreExpiry < now ||
            (typeof my.storage.splStore.splMap.mapsPageName !== "undefined" &&
              my.storage.splStore.splMap.mapsPageName !== null &&
              my.storage.splStore.splMap.mapsPageName.indexOf("help.spartansense.com") > -1) ||
            (typeof my.storage.splStore.splMap.toolsPageName !== "undefined" &&
              my.storage.splStore.splMap.toolsPageName !== null &&
              my.storage.splStore.splMap.toolsPageName.indexOf("help.spartansense.com") > -1)) {
            me.getSplSettings()
              .then(() => {
                // Update local watchlist cache from remote
                if (typeof my.storage.splStore.splMap.splGeotabMapWatchlist !== "undefined") {
                  my.storage.sensorData.vehRegistry.watchlist = my.storage.splStore.splMap.splGeotabMapWatchlist;
                }
                me.startup();
              })
              .catch((reason) => my.ui.showError(reason));
          }
          else {
            my.splSessionMgr = new INITSplSessionMgr(my.splApi, my.storage.credentials);
            me.startup();
          }

          // Init App Handler(s)
          window.navigateToSplTools = me.navigateToSplTools.bind(this); // Page-Navigation Handler
          window.fetchVehSensorDataAsync = me.fetchVehSensorDataAsync.bind(this); // Async Sensor Data Fetch Handler
        });
      },

      /**
       * startup() Startup tasks for SplGeotabMap Add-in
       *
       * @return void
       */
      startup: function () {
        // Update moment() with User-defined Timezone
        moment.tz.setDefault(my.storage.splStore.timezone);

        // Switch to User-defined Language
        if (my.storage.splStore.lang !== my.defaultLanguage) {
          me.tr.switchTo(my.storage.splStore.lang);
        }

        // Monitor Parent Window Width
        me.windowWidthMonitor();

        // Init Panel Vehicle Jumper
        my.ui.panelVehJumper.init();

        // Complete App API Event Registration(s)
        loadInitEventsPostTr(my);

        // Reset sensor data search for all vehicles
        me.resetSearch();

        // Apply run-time settings to sensor data search library
        my.sdataTools.setSensorDataLifetimeInSec(my.storage.splStore.sensorInfoRefreshRate); // "sensorInfoRefreshRate" from SplTools
        my.sdataTools.setSensorDataNotFoundMsg(my.tr("sensors_not_found"));
        my.sdataTools.setSensorSearchInProgressResponseMsg(my.tr("panel_search_busy_msg"));

        // Init About Info in Logo / Watermark
        my.logo.init();

        // Manage UI and Services, after short wait for UI to load in DOM
        setTimeout(function () {
          my.app.monitorVehSensorDataStatus();
        }, 500);

        // Start Sensor Data Panel UI Update and Fault Alerts Monitoring Polling Service / Task
        my.ui.updateService.start();

        // Invoke callback if provided to init()
        if (me._callback) {
          me._callback();
          me._callback = null;
        }
      },

      /**
       * getSplSettings() Fetch and store locally SpartanLync Store data for current logged-in Geotab Account
       *
       * @return promise
       */
      getSplSettings: function () {
        return new Promise((resolve, reject) => {
          my.service.api
            .getSession()
            .then(function (geotab) {
              my.storage.credentials.db = geotab.database;
              my.storage.credentials.username = geotab.userName;
              my.storage.credentials.server = geotab.domain;
              my.storage.credentials.sessionId = geotab.sessionId;

              my.splSessionMgr = new INITSplSessionMgr(my.splApi, my.storage.credentials);
              my.splSessionMgr.getSettings(
                (remoteStore, dbDeviceIds) => {
                  //
                  // Report Error if settings are:
                  // 1. Missing
                  // 2. Stale (older than expiry date as defined in "cachedStoreLifetime" setting)
                  // 3. non-MyGeotab (containes SplMap/SplTools URL pageName reference to proxy instance(s) running on help.spartansense.com)
                  //
                  if (remoteStore === null || typeof remoteStore.splMap === "undefined") {
                    reject(my.tr("error_startup_nosettings"));
                  } else if (typeof remoteStore.splMap.mapsPageName === "undefined" || !remoteStore.splMap.mapsPageName ||
                    remoteStore.splMap.mapsPageName.indexOf("help.spartansense.com") > -1) {
                    reject(my.tr("error_startup_nosplmap"));
                  } else if (typeof remoteStore.splMap.toolsPageName === "undefined" || !remoteStore.splMap.toolsPageName ||
                    remoteStore.splMap.toolsPageName.indexOf("help.spartansense.com") > -1) {
                    reject(my.tr("error_startup_nospltools"));
                  }
                  my.storage.splStoreFetchedUnix = moment().utc().unix();
                  my.storage.splStore = remoteStore;
                  my.storage.dbDeviceIds = dbDeviceIds;
                  resolve(); // Notify on successful Load
                },
                (reason) => reject(my.tr("error_startup_general") + " " + reason)
              );
            })
            .catch((reason) => reject(my.tr("error_startup_general") + " " + reason));
        });
      },

      /**
       * saveWatchlist(): Save Watchlist locally and remotely
       * 1. Fetch most current SpartanLync Store data
       * 2. update Store data with current watchlist array
       * 3. Save SpartanLync Store data remotely
       *
       * @return void
       */
      saveWatchlist: function (args) {
        const saveLocallyNow = typeof args === "string" && args.toUpperCase() === "NOW" ? true : false;

        // Ensure local and remote Watchlists are synced before SAVE operation
        if (typeof my.storage.sensorData.vehRegistry.watchlist !== "undefined" &&
          typeof my.storage.splStore.splMap.splGeotabMapWatchlist !== "undefined" &&
          JSON.stringify(my.storage.sensorData.vehRegistry.watchlist) !== JSON.stringify(my.storage.splStore.splMap.splGeotabMapWatchlist)) {
          my.storage.splStore.splMap.splGeotabMapWatchlist = my.storage.sensorData.vehRegistry.watchlist;
        }

        // Save settings immediately, not after remote update
        if (saveLocallyNow) {
          my.localStore.save("NOW");
        }

        // Perform remote update
        my.splSessionMgr.getSettings(
          (remoteStore, dbDeviceIds) => {
            if (remoteStore !== null && typeof remoteStore.splMap !== "undefined") {
              my.storage.splStoreFetchedUnix = moment().utc().unix();
              my.storage.splStore = remoteStore;
              my.storage.dbDeviceIds = dbDeviceIds;
            }
            my.storage.splStore.timestamp = moment().utc().format(); // Set timestamp of local Storage object to NOW
            my.storage.splStore.splMap.splGeotabMapWatchlist = my.storage.sensorData.vehRegistry.watchlist;
            my.splSessionMgr.syncSettings(my.storage.splStore, dbDeviceIds,
              (accepted) => {
                // If accepted by Remote, save locally
                if (accepted) {
                  console.log("--- Successfully saved Watchlist Remotely");
                  if (!saveLocallyNow) {
                    my.localStore.save();
                  }
                }
                else {
                  my.ui.showMsg(my.tr("error_failed_saving_watchlist"));
                }
              },
              // Error Handler
              (reason) => my.ui.showMsg(my.tr("error_failed_saving_watchlist") + " " + reason));
          },
          (reason) => my.ui.showMsg(my.tr("error_failed_saving_watchlist") + " " + reason)
        );
      },

      /**
       * getWatchlistByIds(): Returns array of Watchlist vehicle Id(s)
       *
       * @return array
       */
      getWatchlistByIds: function () {
        return my.storage.sensorData.vehRegistry.watchlist.map(vehObj => { return vehObj.id; });
      },

      /**
       * getWatchlistVehNameById(): Returns vehicle Name from Watchlist using its Id
       *
       * @return string ("" if not found)
       */
      getWatchlistVehNameById: function (vehId) {
        let vehName = "";
        if (vehId) {
          for (const vehObj of my.storage.sensorData.vehRegistry.watchlist) {
            if (vehObj.id === vehId) {
              vehName = vehObj.name;
              break;
            }
          }
        }
        return vehName;
      },

      /**
       * addWatchlistItem(): Add vehId+Name to watchlist array, then sort array by Name
       *
       *  @param {string} [vehId] The vehicle Id to add
       *  @param {string} [vehName] The vehicle Name to add
       *
       * @return void
       */
      addWatchlistItem: function (vehId, vehName) {
        if (vehId && vehName && !me.getWatchlistByIds().includes(vehId)) {
          // Append new item
          my.storage.sensorData.vehRegistry.watchlist.push({
            id: vehId,
            name: vehName,
          });
          // Sort by Name
          my.storage.sensorData.vehRegistry.watchlist.sort((a, b) => (a.name > b.name) ? 1 : -1);
        }
      },

      /**
       * delWatchlistItem(): Delete watchlist item from array
       *  @param {string} [vehId] The vehicle Id to delete
       *
       * @return void
       */
      delWatchlistItem: function (vehId) {
        if (vehId) {
          my.storage.sensorData.vehRegistry.watchlist =
            my.storage.sensorData.vehRegistry.watchlist.filter(vehObj => vehObj.id !== vehId);
        }
      },

      /**
       * monitorVehSensorDataStatus(): Manage update service tasks that performs UI updates
       * Based on whether
       *   - Vehicles exist in watchlist for showing sensor data in Panel
       *   or
       *   - Vehicle fault alerts to show on map
       *
       * @return void
       */
      // eslint-disable-next-line complexity
      monitorVehSensorDataStatus: function (mode) {
        const inUpdateMode = typeof mode !== "undefined" && mode !== null && mode === "updateServiceMode" ? true : false;
        const watchListIds = my.app.getWatchlistByIds();
        const calls = [];

        // Init watchlistAndAlertData for MapFaults + Sensor-Data-Watches
        my.storage.sensorData.watchlistAndAlertData = {
          index: [],
          get sortedIndex() {
            const me = this;
            me.index.sort((vehIdA, vehIdB) => {
              return (me.getVehName(vehIdA) > me.getVehName(vehIdB)) ? 1 : -1;
            });
            return me.index;
          },
          getVehName: (vehId) => {
            return typeof my.storage.sensorData.cache[vehId] !== "undefined" &&
              my.storage.sensorData.cache[vehId].data &&
              my.storage.sensorData.cache[vehId].data.vehName ?
              my.storage.sensorData.cache[vehId].data.vehName :
              my.app.getWatchlistVehNameById(vehId);
          }
        };

        // Include search for vehicles with "post-Ignition" Fault Alerts
        for (const vehId of me.getVehFaultIDs()) {
          for (const faultObjOriginal of me.getFaultData(vehId)) {
            const faultObj = JSON.parse(JSON.stringify(faultObjOriginal)); // clone fault object... can't modify the original
            if (typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
              typeof faultObj.alert !== "undefined" &&
              faultObj.occurredOnLatestIgnition) {

              // Remove Fault alert with locations that do not exist
              let skipFault = false;
              if (typeof faultObj.loc !== "undefined" && Array.isArray(faultObj.loc) && faultObj.loc.length) {
                faultObj.loc = faultObj.loc.filter((locObj) => {
                  return me.locExistsInSensorData(vehId, faultObj.alert.type, locObj);
                });
                if (!faultObj.loc.length) {
                  skipFault = true;
                }
              }
              if (skipFault) { continue; }

              // Process Fault
              //
              // - Init
              if (!my.storage.sensorData.watchlistAndAlertData.index.includes(vehId)) {
                // Init
                my.storage.sensorData.watchlistAndAlertData.index.push(vehId);
                my.storage.sensorData.watchlistAndAlertData[vehId] = JSON.parse(JSON.stringify(my.watchlistAndAlertSettings.defaultCfg));

                // Alert notification data
                my.storage.sensorData.watchlistAndAlertData[vehId].type.push("alert");
                my.storage.sensorData.watchlistAndAlertData[vehId].alerts = [];
                my.storage.sensorData.watchlistAndAlertData[vehId].alertlevel = {
                  time: 0,
                  color: "",
                  iconName: "",
                  tooltip: {}
                };

                // Add per-vehicle info to API request
                calls.push(["Get", {
                  typeName: "Device",
                  search: { id: vehId }
                }]);
                calls.push(["Get", {
                  typeName: "DeviceStatusInfo",
                  search: { deviceSearch: { id: vehId } }
                }]);
              }
              my.storage.sensorData.watchlistAndAlertData[vehId].alerts.push(faultObj);

              // - Sort to Highest-Severify, then Most-Recent Timestamp Fault
              if (faultObj.occurredOnLatestIgnition &&
                faultObj.time &&
                faultObj.alert.type !== "Sensor Fault" &&
                faultObj.alert.color.toString().trim() !== ""
              ) {
                const alertlevel = my.storage.sensorData.watchlistAndAlertData[vehId].alertlevel;
                if (!alertlevel.color ||
                  (alertlevel.color && alertlevel.color.toUpperCase() === "AMBER" && faultObj.alert.color.toUpperCase() === "RED") ||
                  (alertlevel.color.toUpperCase() === faultObj.alert.color.toUpperCase() && faultObj.time > alertlevel.time)) {

                  const sensorLocArr = me.convertLocArrObjToLocDescArr(faultObj.loc);

                  // Add instructional message
                  sensorLocArr.push(my.tr("alert_tooltip_instruction_msg"));

                  // Add TempTrac Threshold Setting value
                  const temptracThresholdHtml =
                    typeof faultObj.threshold !== "undefined" ?
                      my.tr("alert_temptrac_threshold_title") + ": " + (faultObj.threshold === "fridge" ? my.tr("alert_temptrac_threshold_fri") : my.tr("alert_temptrac_threshold_fre"))
                      : "";

                  alertlevel.time = faultObj.time;
                  alertlevel.color = faultObj.alert.color;
                  alertlevel.iconName = "mapVehAlertIcon" + faultObj.alert.color.charAt(0).toUpperCase() + faultObj.alert.color.slice(1).toLowerCase();
                  alertlevel.tooltip.title = "SpartanLync " + my.tr("alert_header") + ": " + my.tr(faultObj.alert.trId) +
                    (faultObj.alert.type === "Tire Pressure Fault" ? " ( " + my.tr("alert_tire_pressure_fault") + " )" : "") +
                    (faultObj.alert.type === "Tire Temperature Fault" ? " ( " + my.tr("alert_temperature_over") + " )" : "") +
                    (faultObj.alert.type === "TempTrac Temperature Fault" ? " (" + temptracThresholdHtml + ")" : "");
                  alertlevel.tooltip.sensorLocLabel = ["@" + me.convertUnixToTzHuman(faultObj.time), my.tr("alert_sensor_location_header") + ":"];
                  alertlevel.tooltip.sensorLocArr = sensorLocArr;
                }
              }
            }
          }
        }

        // Include search for vehicles in Watchlist
        if (watchListIds.length) {

          for (const vehId of watchListIds) {
            if (!my.storage.sensorData.watchlistAndAlertData.index.includes(vehId)) {
              my.storage.sensorData.watchlistAndAlertData.index.push(vehId);
              my.storage.sensorData.watchlistAndAlertData[vehId] = JSON.parse(JSON.stringify(my.watchlistAndAlertSettings.defaultCfg));
            }
            my.storage.sensorData.watchlistAndAlertData[vehId].type.push("watchlist");
            calls.push(["Get", {
              typeName: "Device",
              search: { id: vehId }
            }]);
            calls.push(["Get", {
              typeName: "DeviceStatusInfo",
              search: { deviceSearch: { id: vehId } }
            }]);
          }

          // Open UI Panel, if closed and not invoded by the UpdateService Task
          me.windowWidthMonitor();
          if (!inUpdateMode && my.panelOpenAllowed) {
            my.ui.openPanel();
          }
        }
        // Stop everything if watchlist empty
        else {

          // Reset UI, if not invoded by the UpdateService Task
          if (!inUpdateMode) {
            my.ui.showMsg(my.tr("panel_user_instruction"));
          }
        }

        // Fetch latest Vehicle information for Watchlist + Fault Alerts
        if (calls.length) {
          my.service.api
            .multiCall(calls)
            .then(function (result) {
              if (result && result.length) {
                for (let i = 0; i < result.length; i += 2) {
                  const [veh] = result[i];
                  const [vehInfo] = result[i + 1];
                  const vehId = veh.id;

                  if (typeof my.storage.sensorData.watchlistAndAlertData[vehId] !== "undefined") {
                    my.storage.sensorData.watchlistAndAlertData[vehId].name = veh.name;
                    my.storage.sensorData.watchlistAndAlertData[vehId].time = moment(vehInfo.dateTime).unix();
                    my.storage.sensorData.watchlistAndAlertData[vehId].speed = vehInfo.speed;
                    my.storage.sensorData.watchlistAndAlertData[vehId].loc.lat = vehInfo.latitude;
                    my.storage.sensorData.watchlistAndAlertData[vehId].loc.lng = vehInfo.longitude;
                  }
                }

                // Render Vehicle Watchlist sensor data data in UI
                if (watchListIds.length) {
                  my.ui.renderPanelHTML();
                }

                // Invoke Map Fault Alerts UI
                my.ui.renderMapAlerts();
              }
            });
        }
      },

      /**
       * locExistsInSensorData(): Check for existence of sensor location object in cahced sensor data
       * @param {string} [vehId] The vehicle Id to search on sensor data
       * @param {string} [locType] Type of sensor associated with specified location object (Temperature or Pressure)
       * @param {object} [locObj] location object with properties for axle, tire and vehicle component
       *
       * @return boolean - TRUE if found, otherwise FALSE if not found or error
       */
      locExistsInSensorData: function (vehId, locType, locObj) {
        if (!vehId || !locType || !locObj || typeof my.storage.sensorData.cache[vehId] === "undefined" || my.storage.sensorData.cache[vehId].data === null) {
          return false;
        }
        const sdataCache = my.storage.sensorData.cache[vehId].data;
        const sdataType = locType === "TempTrac Temperature Fault" ? "temptrac" : (locType === "Tire Temperature Fault" ? "tpmstemp" : "tpmspress");
        const locId = locType === "TempTrac Temperature Fault" ? "temptrac_zone" + locObj.zone : ((locType === "Tire Temperature Fault" ? "tiretemp_axle" : "tirepress_axle") + locObj.axle + "tire" + locObj.tire);

        if (sdataCache && typeof sdataCache.vehCfg !== "undefined" && typeof sdataCache.vehCfg.compsdata !== "undefined" &&
          typeof locObj.vehComp !== "undefined" && locObj.vehComp && typeof sdataCache.vehCfg.compsdata[locObj.vehComp] !== "undefined") {
          const sdata = sdataCache.vehCfg.compsdata[locObj.vehComp];
          for (const sdataLocId in sdata[sdataType]) {
            const sdataLocObj = sdata[sdataType][sdataLocId];
            if (sdataLocObj.id === locId) {
              return true;
            }
          }
        }
        return false;
      },

      /**
       * Perform page-redirect navigation to SpartanLync Tools Add-in
       * @param {string} [vehId] The vehicle Id to navigate to
       * @param {string} [vehName] The vehicle name shown in UI on error
       *
       * @return void
       */
      navigateToSplTools: (vehId, vehName) => {
        const splToolsPageName = my.storage.splStore.splMap.toolsPageName;
        console.log("----- Navigating to SpartanLync Tools Add-in [ " + splToolsPageName + " ] to view Vehicle [ " + vehName + " ]");
        my.service.page
          .hasAccessToPage(splToolsPageName)
          .then((accessGranted) => {
            if (accessGranted) {
              my.app.cancelPendingTasks();
              my.service.page
                .go(splToolsPageName, {
                  switchToVehId: vehId,
                  switchToVehName: vehName,
                })
                .catch((reason) => my.ui.showError(my.tr("error_spltools_switch_failed") + " " + reason));
            } else {
              my.ui.showError(my.tr("error_spltools_switch_noprivsfound"));
            }
          })
          .catch((reason) => my.ui.showError(my.tr("error_spltools_switch_getnoprivs") + " " + reason));
      },

      /**
       * getCachedSensorDataStatusForVeh() Reporting current status of Sensor data for Vehicle
       * @param {string} [vehId] The vehicle Id to search on sensor data
       * @param {string} [vehName] The vehicle name shown in UI on error
       *
       * @return "BUSY"     - Searching for NEW data
       *         "BUSY-NEW" - Searching for NEW data, But STALE data found
       *         "NOTFOUND" - No Sensors Found
       *         "FOUND"    - Found Sensor data
       */
      getCachedSensorDataStatusForVeh: function (vehId, vehName) {

        if (typeof my.sdataTools._cache[vehId] === "undefined") {
          me.getSensorData(vehId, vehName);
          return "BUSY";
        }
        else if (my.sdataTools._cache[vehId].searching) {
          if (my.sdataTools._cache[vehId].data === null) {
            return "BUSY";
          } else {
            return "BUSY-NEW";
          }
        }
        else if (my.sdataTools._cache[vehId].data === null) {
          if (typeof my.sdataTools._cache[vehId].noSensorDataFound === "undefined") {
            me.getSensorData(vehId, vehName);
            return "BUSY";
          }
          else {
            if (my.sdataTools._cache[vehId].noSensorDataFound) {
              return "NOTFOUND";
            }
            else {
              me.getSensorData(vehId, vehName);
              return "BUSY";
            }
          }
        }
        else {
          // Perfrom update if vehicle sensor data is stale
          if (my.sdataTools._cache[vehId].expiry < moment().utc().unix()) {
            me.getSensorData(vehId, vehName);
          }
          return "FOUND";
        }
      },

      /**
       * getSensorData() Invoke the retrieval process for sensor data + vehicle fault/ignition data into cache
       * @param {string} [vehId] The vehicle Id to search on sensor data
       * @param {string} [vehName] The vehicle name shown in UI on error
       *
       * @return void
       */
      getSensorData: function (vehId, vehName) {

        // Get SpartanLync Sensor Data
        if (my.storage.sensorData.searchInProgress) {
          const aSyncGoLib = INITGeotabTpmsTemptracLib(
            my.service.api,
            my.sensorSearchRetryRangeInDays,
            my.sensorSearchTimeRangeForRepeatSearchesInSeconds,
            my.faultSearchRetryRangeInDays,
            my.faultSearchTimeRangeForRepeatSearchesInSeconds
          );
          const aSyncSdataTools = new INITSplSensorDataTools(aSyncGoLib, my.storage.sensorData.cache);
          aSyncSdataTools.setSensorDataLifetimeInSec(my.storage.splStore.sensorInfoRefreshRate);
          aSyncSdataTools.setSensorDataNotFoundMsg(my.tr("sensors_not_found"));
          aSyncSdataTools.setSensorSearchInProgressResponseMsg(my.tr("panel_search_busy_msg"));
          aSyncSdataTools.setVehComponents(my.vehComponents.toEn);
          aSyncSdataTools.fetchCachedSensorData(vehId, vehName)
            .then(() => me.postGetSensorData(vehId, vehName))
            .catch((reason) => console.log(`--- getSensorData(ASYNC) Error fetching sensor data for [ ${vehName} / ${vehId} ]: `, reason))
            .finally(() => {
              my.storage.sensorData.searchInProgress = "";
            });
        }
        else {
          my.storage.sensorData.searchInProgress = vehId;
          my.sdataTools.fetchCachedSensorData(vehId, vehName)
            .then(() => me.postGetSensorData(vehId, vehName))
            .catch((reason) => console.log(`--- getSensorData() Error fetching sensor data for [ ${vehName} / ${vehId} ]: `, reason))
            .finally(() => {
              my.storage.sensorData.searchInProgress = "";
            });
        }

        // Get Vehicle Faults / Ignition data
        const overrideFirstTimeCall = my.app.getFaultData(vehId) === null ? null : false;
        me.fetchVehFaultsAndIgnitionAsync(vehId, overrideFirstTimeCall)
          .then(([faults, vehIgnitionInfo]) => {

            // Update Faults & Ignition data cache(s)
            me.storeFaultData(vehId, faults);
            me.storeIgnData(vehId, vehIgnitionInfo);

            // Update Faults cache with new ignition data
            if (typeof vehIgnitionInfo !== "undefined" && vehIgnitionInfo !== null &&
              typeof vehIgnitionInfo === "object" && typeof vehIgnitionInfo["on-latest"] !== "undefined") {
              me.updateFaultStatusUsingIgnData(vehId);
            }
            me.configTemptracFaults(vehId);
            me.reportNewFaults(vehId);
          })
          .catch((reason) => {
            console.log("---- Error while searching for FAULTS on VehicleID [ " + vehId + " ] named [ " + vehName + " ]: ", reason);
          });
      },

      /**
       * postGetSensorData() Operations perfromed after fetching sensor data into cache
       * @param {string} [vehId] The vehicle Id to process
       * @param {string} [vehName] The vehicle name shown in UI on error
       *
       * @return void
       */
      postGetSensorData: function (vehId, vehName) {
        // Reset search status and Backup found sensor data
        my.storage.sensorData.searchInProgress = "";

        // Perform SAVE operation, to backup sensor search changes
        my.localStore.save();
      },

      /**
       * fetchSensorTypes() Analyse sensor data looking for Temptrac/TPMS Sensor Types
       * @param {string} [vehId] The vehicle Id to fetch on
       *
       * @return Array() of strings "Temptrac" / "TPMS"
       */
      fetchSensorTypes: function (vehId) {
        const sensorTypes = [];
        if (typeof my.sdataTools._cache[vehId] !== "undefined") {
          const sdata = my.sdataTools._cache[vehId].data;

          if (typeof sdata.vehCfg.ids !== "undefined" && Array.isArray(sdata.vehCfg.ids)) {
            const stypes = [];
            sdata.vehCfg.ids.forEach(function (comp) {
              const compSdata = sdata.vehCfg.compsdata[comp];
              if (Object.keys(compSdata.temptrac).length) {
                stypes.push("temptrac");
              }
              if (Object.keys(compSdata.tpmspress).length || Object.keys(compSdata.tpmstemp).length) {
                stypes.push("tpms");
              }
            });
            if (stypes.includes("temptrac")) {
              sensorTypes.push("Temptrac");
            }
            if (stypes.includes("tpms")) {
              sensorTypes.push("TPMS");
            }
          }
          else {
            if (Object.keys(sdata.temptrac).length) {
              sensorTypes.push("Temptrac");
            }
            if (Object.keys(sdata.tpmspress).length || Object.keys(sdata.tpmstemp).length) {
              sensorTypes.push("TPMS");
            }
          }
        }
        return sensorTypes;
      },

      /**
       * fetchAdditionalComponents() Analyse sensor data looking for Vehicle Components additional to 'tractor'
       * @param {string} [vehId] The vehicle Id to fetch on
       *
       * @return Array() of strings
       */
      fetchAdditionalComponents: function (vehId) {
        const additionalCompsArr = [];
        if (typeof my.sdataTools._cache[vehId] !== "undefined") {
          const sdata = my.sdataTools._cache[vehId].data;
          if (typeof sdata.vehCfg.ids !== "undefined" && Array.isArray(sdata.vehCfg.ids)) {
            const comps = sdata.vehCfg.ids.filter((compId) => { return compId !== "tractor"; });
            if (comps.length) {
              let additionalCompsTxt = my.tr("sensors_tooltip_comp_found_msg") + ": ";
              additionalCompsTxt += comps.map((compId) => {
                return my.tr(my.vehComponents.toTr[compId]);
              }).join(", ");
              additionalCompsArr.push(additionalCompsTxt);
            }
          }
        }
        return additionalCompsArr;
      },

      /**
      * fetchVehSensorDataAsync() Asynchronously fetch Temptrac/TPMS sensor data
      * @param {string} [vehId] The vehicle Id to fetch on
      * @param {string} [vehComp] The vehicle component to filter by
      * @param {string} [firstTimeCallOverride] Override default behaviour and use date range based on firstTime/Update state
      *
      * @return object / string (on Error)
      */
      fetchVehSensorDataAsync: function (vehId, vehComp, firstTimeCallOverride) {
        const vehComponent = vehComp || "";
        const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
        return new Promise((resolve, reject) => {
          const aSyncGoLib = INITGeotabTpmsTemptracLib(
            my.service.api,
            my.sensorSearchRetryRangeInDays,
            my.sensorSearchTimeRangeForRepeatSearchesInSeconds,
            my.faultSearchRetryRangeInDays,
            my.faultSearchTimeRangeForRepeatSearchesInSeconds
          );
          aSyncGoLib.getData(vehId, vehComponent, function (sensorData) {
            if (sensorData === null) {
              reject(my.tr("sensors_not_found"));
            } else {
              resolve(sensorData);
            }
          }, overrideFirstTimeCall);
        });
      },

      /**
      * Asynchronously Fetch Vehicle Faults and Ignition data
      * @param {string} [vehId] The vehicle Id to fetch on
      * @param {string} [firstTimeCallOverride] Override default behaviour and use date range based on firstTime/Update state
      *
      * @return {array} objects
      */
      fetchVehFaultsAndIgnitionAsync: function (vehId, firstTimeCallOverride) {
        const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
        return new Promise((finalResolve) => {

          // Poll for TPMS Faults
          const fTask1 = new Promise((subResolve1) => {
            const aSyncGoLib = INITGeotabTpmsTemptracLib(
              my.service.api,
              my.sensorSearchRetryRangeInDays,
              my.sensorSearchTimeRangeForRepeatSearchesInSeconds,
              my.faultSearchRetryRangeInDays,
              my.faultSearchTimeRangeForRepeatSearchesInSeconds
            );
            aSyncGoLib.getFaults(vehId, function (faults, vehIgnitionInfo) {
              subResolve1([faults, vehIgnitionInfo]);
            }, overrideFirstTimeCall);
          });

          // Poll for TempTrac Faults
          const fTask2 = new Promise((subResolve2) => {
            me.fetchTemptracFaults(vehId, (temptracFaults) => {
              subResolve2(temptracFaults);
            });
          });

          // Merge all the faults together amd return with Ignition info
          Promise.allSettled([fTask1, fTask2])
            .then(([tpmsResult, temptracResult]) => {
              const [tpmsFaults, vehIgnitionInfo] = tpmsResult.value;
              const temptracFaults = temptracResult.value;
              let faults;

              // Merge TempTrac with TPMS Fault search results
              if (Array.isArray(temptracFaults) && temptracFaults.length) {
                faults = tpmsFaults === null ? temptracFaults : tpmsFaults.concat(temptracFaults);
              }
              else {
                faults = tpmsFaults;
              }
              finalResolve([faults, vehIgnitionInfo]);
            });
        });
      },

      /**
      * Fetch the Vehicle TempTrac Alarm Threshold Type from SplTools splStore + dbDeviceIds data
      *
      *  @returns string
      */
      getTemptracVehThresholdSetting: function (vehId) {
        const me = this;
        let vehThresholdType = "fridge";

        if (vehId && typeof my.storage.splStore.temptracAlarmThreshold !== "undefined") {
          vehThresholdType = my.storage.splStore.temptracAlarmThreshold;
          if (typeof my.storage.dbDeviceIds.ids[vehId] !== "undefined" &&
            typeof my.storage.dbDeviceIds.ids[vehId].temptracAlarmThreshold !== "undefined" &&
            my.storage.dbDeviceIds.ids[vehId].temptracAlarmThreshold) {
            vehThresholdType = my.storage.dbDeviceIds.ids[vehId].temptracAlarmThreshold;
          }
        }
        return vehThresholdType;
      },

      /**
      * Fetch TempTrac Faults generated in the past over a range of days for a specified vehicle
      * @param {string} [vehId] The vehicleId to fetch TempTrac faults for
      * @param {function} [callback] Function invoked and passed TempTrac fault data (NULL if nothing found)
      *
      * @return void
      */
      fetchTemptracFaults: function (vehId, callback) {
        if (!callback || typeof callback !== "function") { return null; }
        if (!vehId) { callback(null); }
        my.fetchTemptracFaultFirstTime[vehId] = typeof my.fetchTemptracFaultFirstTime[vehId] === "undefined" ? true : false;

        const toFaultDateObj = moment.utc();
        const searchRangeArr = my.fetchTemptracFaultFirstTime[vehId] ? my.faultSearchRetryRangeInDays : [1];
        const searchUnit = my.fetchTemptracFaultFirstTime[vehId] ? "days" : "hour";
        const vehTemptracThresholdType = me.getTemptracVehThresholdSetting(vehId);
        me.searchForTemptracFaults(vehId, toFaultDateObj, searchRangeArr, searchUnit, vehTemptracThresholdType)
          .then((faults) => {
            callback(faults);
          });
      },

      /**
      * Asynchronously attempt searches for Vehicle TempTrac Faults over a range of days
      * @param {string} [vehId] The vehicleId to search on
      * @param {object} [toFaultDateObj] Moment Object representing To date in Search
      * @param {array}  [searchRangeArr] Array of date range values searched in sequential order before returning results or failing
      * @param {string} [searchUnit] Unit in "days" or "hour" to interpret values of [searchRangeArr]
      * @param {string} [tempThreshold] TempTrac Threshold search criteria (Must be "fridge" or "freezer")
      *
      * @return {array} objects
      */
      searchForTemptracFaults: function (vehId, toFaultDateObj, searchRangeArr, searchUnit, tempThreshold) {
        return new Promise((resolve) => {

          if (!vehId || !toFaultDateObj || !searchRangeArr || !searchUnit || !tempThreshold ||
            !Array.isArray(searchRangeArr) || !searchRangeArr.length ||
            typeof toFaultDateObj !== "object" || !moment.isMoment(toFaultDateObj)) {
            resolve(null);
          }

          (async () => {
            const toFaultDate = toFaultDateObj.format();
            let fdata = null;

            for (const idx in searchRangeArr) {
              const searchRange = searchRangeArr[idx];
              const fromFaultDate = moment.unix(toFaultDateObj.unix()).utc().subtract(searchRange, searchUnit).format();

              console.log("Please Wait...Attempt#" + (parseInt(idx) + 1) +
                " Retrieving TempTrac Fault data on VehicleID [ " + vehId + " ] using " +
                searchRange + " " + searchUnit + " date range: FROM: " +
                fromFaultDate + " UTC => TO: " + toFaultDate + " UTC");

              await new Promise((loopResolve) => {
                my.splSessionMgr.getTempTracFaults(vehId, fromFaultDate, toFaultDate, tempThreshold, (faults) => {
                  fdata = faults;
                  loopResolve();
                }, () => loopResolve());
              });
              if (fdata !== null) { break; }
            }

            // Report to console
            if (fdata === null || fdata && !fdata.length) {
              console.log("VehicleID [ " + vehId + " ]: NO TempTrac FAULT DATA FOUND for this date range!");
            }
            resolve(fdata);
          })();
        });
      },

      /**
       * resetSearch() Clear sensor data search metadata
       *
       * @return void
       */
      resetSearch: function () {
        my.storage.sensorData.vehRegistry.tooltip = "";
        if (my.storage.sensorData.searchInProgress) {
          console.log(`--- resetSearch() Clearing stale search on VehId [ ${my.storage.sensorData.searchInProgress} ]`);
          my.storage.sensorData.searchInProgress = "";
        }
        for (const vehId in my.storage.sensorData.cache) {
          if (my.storage.sensorData.cache[vehId].searching) {
            console.log(`--- resetSearch() Resetting search status for VehId [ ${vehId} ]`);
            my.storage.sensorData.cache[vehId].searching = false;
          }
        }
        my.sdataTools._cache = my.storage.sensorData.cache;
      },

      /**
       * resetApp() Clear and reset all App data
       *
       * @return void
       */
      resetApp: function () {
        if (my.sdataTools.resetCache()) {
          my.localStore.clear(() => {
            my.resetBtnElemObj.blur();

            me.cancelPendingTasks();
            me.resetSearch();
            my.ui.clearMapAlerts();
            my.storage.splStore = null;
            my.sdataTools.resetCache();
            my.fetchTemptracFaultFirstTime = {};
            my.storage.sensorData.cache = {};
            my.storage.sensorData.faultCache = {};
            my.storage.sensorData.ignitionCache = {};
            my.storage.sensorData.watchlistAndAlertData = { index: [] };
            me.init(() => {
              setTimeout(function () {
                my.ui.showMsg(my.tr("reset_btn_msg") + "<p>" + my.tr("panel_user_instruction"));
              }, 700);
            });
          });
        } else {
          my.ui.showError(my.tr("reset_failed_busy"));
        }
      },

      /**
       * cancelPendingTasks() Cancel all Pending Tasks in App
       *
       * @return void
       */
      cancelPendingTasks: function () {
        // Stop Panel Update Polling Service / Task
        my.ui.updateService.stop();
      },

      /**
      * Convert Location Array of Objects to Array of Descriptions
      * [0: {axle: 1, tire: 2, vehComp: "tractor"}] => [0: "Axle 1 Tire 2 - Tractor"]
      *
      *  @returns string
      */
      convertLocArrObjToLocDescArr: function (locArr) {
        const locDescArr = [];
        if (typeof locArr !== "undefined" && locArr !== null &&
          Array.isArray(locArr) && locArr.length) {
          locArr.forEach(locObj => {
            const locStr = (typeof locObj.zone !== "undefined" ? "Zone " + locObj.zone : ("Axle " + locObj.axle + " Tire " + locObj.tire)) + " - " + my.vehCompDb.names[locObj.vehComp];
            locDescArr.push(me._locTr(locStr));
          });
        }
        return locDescArr;
      },

      _locTr: function (rawVal) {
        let val = rawVal.toString().trim();
        if (val) {
          val = val.replace("Zone", my.tr("alert_desc_zone"));
          val = val.replace("Axle", my.tr("alert_desc_axle"));
          val = val.replace("Tire", my.tr("alert_desc_tire"));
          val = val.replace("Tractor", my.tr("alert_desc_tractor"));
          val = val.replace("Trailer", my.tr("alert_desc_trailer"));
          val = val.replace("Dolly", my.tr("alert_desc_dolly"));
        }
        return val;
      },

      /**
       * Convert from Unix timestamp to Human-readable time
       * eg. Sa Aug 17, 2020 7:00 PM EDT
       *
       *  @return string
       */
      convertUnixToTzHuman: function (unixTime) {
        return isNaN(unixTime) ? null : moment.unix(unixTime).format(my.timeFormat);
      },

      getVehFaultIDs: function () {
        const me = this;
        return Object.keys(my.storage.sensorData.faultCache);
      },

      getFaultData: function (vehId) {
        if (typeof my.storage.sensorData.faultCache[vehId] !== "undefined") {
          const fdataArr = [];
          for (const faultId in my.storage.sensorData.faultCache[vehId]) {
            fdataArr.push(my.storage.sensorData.faultCache[vehId][faultId]);
          }
          return fdataArr;
        }
        return null;
      },

      storeFaultData: function (vehId, data) {

        if (typeof data !== "undefined" && data !== null && Array.isArray(data) && data.length) {

          if (typeof my.storage.sensorData.faultCache[vehId] === "undefined") {
            my.storage.sensorData.faultCache[vehId] = {};
          }

          // Update fault data cache with new Fault data from Geotab & TempTrac Fault API
          for (const faultObj of data) {
            const faultId = "fault_" + faultObj.id;
            if (typeof my.storage.sensorData.faultCache[vehId][faultId] === "undefined") {
              my.storage.sensorData.faultCache[vehId][faultId] = {};
            }
            if (typeof my.storage.sensorData.faultCache[vehId][faultId].time === "undefined" ||
              faultObj.time > my.storage.sensorData.faultCache[vehId][faultId].time) {

              // Exclude "Sensor Fault" Types / "Missing Sensor" Fault from cache
              if (typeof faultObj.alert !== "undefined" && typeof faultObj.alert.type !== "undefined" &&
                faultObj.alert.type === "Sensor Fault") {
                delete my.storage.sensorData.faultCache[vehId][faultId];
                continue;
              }
              // Initialize Faults from TempTrac Fault API as FALSE
              if (typeof faultObj.occurredOnLatestIgnition !== "undefined" && faultObj.occurredOnLatestIgnition === null) {
                faultObj.occurredOnLatestIgnition = false;
              }
              my.storage.sensorData.faultCache[vehId][faultId] = faultObj;
            }
          }
        }
      },

      getIgnData: function (vehId) {
        if (typeof my.storage.sensorData.ignitionCache[vehId] !== "undefined") {
          return my.storage.sensorData.ignitionCache[vehId];
        }
        return null;
      },

      storeIgnData: function (vehId, data) {
        if (typeof data !== "undefined" &&
          data !== null &&
          typeof data === "object" &&
          typeof data["on-latest"] !== "undefined") {

          // Create ignition data cache
          if (typeof my.storage.sensorData.ignitionCache[vehId] === "undefined" ||
            typeof my.storage.sensorData.ignitionCache[vehId]["on-latest"] === "undefined" ||
            typeof my.storage.sensorData.ignitionCache[vehId]["off-latest"] === "undefined") {
            my.storage.sensorData.ignitionCache[vehId] = data;
          }
          // Merge new data into ignition data cache
          else {
            my.storage.sensorData.ignitionCache[vehId]["on-latest"] =
              data["on-latest"] > my.storage.sensorData.ignitionCache[vehId]["on-latest"] ?
                data["on-latest"] : my.storage.sensorData.ignitionCache[vehId]["on-latest"];
            my.storage.sensorData.ignitionCache[vehId]["off-latest"] =
              data["off-latest"] > my.storage.sensorData.ignitionCache[vehId]["off-latest"] ?
                data["off-latest"] : my.storage.sensorData.ignitionCache[vehId]["off-latest"];
            my.storage.sensorData.ignitionCache[vehId]["byTime"] =
              { ...my.storage.sensorData.ignitionCache[vehId]["byTime"], ...data["byTime"] };
            my.storage.sensorData.ignitionCache[vehId]["on"].push(...data["on"]);
            my.storage.sensorData.ignitionCache[vehId]["off"].push(...data["off"]);
          }
        }
      },

      updateFaultStatusUsingIgnData: function (vehId) {
        if (typeof vehId !== "undefined" && vehId !== null &&
          typeof my.storage.sensorData.ignitionCache !== "undefined" && my.storage.sensorData.ignitionCache !== null &&
          typeof my.storage.sensorData.ignitionCache[vehId] !== "undefined" && typeof my.storage.sensorData.ignitionCache === "object" &&
          typeof my.storage.sensorData.faultCache !== "undefined" && my.storage.sensorData.faultCache !== null && typeof my.storage.sensorData.faultCache[vehId] !== "undefined" &&
          typeof my.storage.sensorData.faultCache[vehId] === "object" && Object.keys(my.storage.sensorData.faultCache[vehId]).length &&
          typeof my.storage.sensorData.ignitionCache[vehId]["on-latest"] !== "undefined"
        ) {
          for (const faultId in my.storage.sensorData.faultCache[vehId]) {
            my.storage.sensorData.faultCache[vehId][faultId].occurredOnLatestIgnition =
              (
                typeof my.storage.sensorData.faultCache[vehId][faultId].time !== "undefined" &&
                my.storage.sensorData.faultCache[vehId][faultId].time >= my.storage.sensorData.ignitionCache[vehId]["on-latest"]
              ) ? true : false;
          }
        }
      },

      configTemptracFaults: function (vehId) {

        const latestTemptracFaultOFF = {
          timeXL: 0,
          timeXH: 0
        };

        if (typeof vehId !== "undefined" && vehId !== null &&
          typeof my.storage.sensorData.faultCache !== "undefined" &&
          my.storage.sensorData.faultCache !== null &&
          typeof my.storage.sensorData.faultCache[vehId] !== "undefined" &&
          typeof my.storage.sensorData.faultCache[vehId] === "object" &&
          Object.keys(my.storage.sensorData.faultCache[vehId]).length
        ) {

          // If Exist, get latest XL/XH TempTrac FaultOFF event
          for (const faultId in my.storage.sensorData.faultCache[vehId]) {
            const faultObj = my.storage.sensorData.faultCache[vehId][faultId];
            if (faultObj.id.indexOf("FaultOff") > -1) {
              if (faultObj.id === "temptracXLFaultOff") {
                latestTemptracFaultOFF.timeXL = faultObj.time;
              }
              if (faultObj.id === "temptracXHFaultOff") {
                latestTemptracFaultOFF.timeXH = faultObj.time;
              }
            }
          }

          // Update TempTrac faults using latest XL/XH TempTrac FaultOFF events
          for (const faultId in my.storage.sensorData.faultCache[vehId]) {
            const faultObj = my.storage.sensorData.faultCache[vehId][faultId];
            if ((latestTemptracFaultOFF.timeXL && faultObj.id.indexOf("fault_temptrac_xl") > -1 && faultObj.time <= latestTemptracFaultOFF.timeXL) ||
              (latestTemptracFaultOFF.timeXH && faultObj.id.indexOf("fault_temptrac_xh") > -1 && faultObj.time <= latestTemptracFaultOFF.timeXH)) {
              faultObj.occurredOnLatestIgnition = false;
            }
          }
        }
      },

      reportNewFaults: function (vehId) {

        let newOrUpdatedFaultAlertCount = 0;

        // Count New Post-Ignition Faults
        if (typeof vehId !== "undefined" && vehId !== null &&
          typeof my.storage.sensorData.faultCache !== "undefined" &&
          my.storage.sensorData.faultCache !== null &&
          typeof my.storage.sensorData.faultCache[vehId] !== "undefined" &&
          typeof my.storage.sensorData.faultCache[vehId] === "object" &&
          Object.keys(my.storage.sensorData.faultCache[vehId]).length
        ) {
          for (const faultId in my.storage.sensorData.faultCache[vehId]) {
            const faultObj = my.storage.sensorData.faultCache[vehId][faultId];
            if (typeof faultObj.alert !== "undefined" && faultObj.occurredOnLatestIgnition) {
              newOrUpdatedFaultAlertCount++;
            }
          }
        }

        // Report to Console
        if (newOrUpdatedFaultAlertCount) {
          console.log("VehicleID [", vehId, "] - " + newOrUpdatedFaultAlertCount + " NEW POST-IGNITION SPARTANLYNC FAULTS FOUND or UPDATED after the last search.");
        }
        else {
          console.log("VehicleID [", vehId, "] - NO NEW POST-IGNITION SPARTANLYNC FAULT DATA FOUND for this date range!");
        }
      },

      windowWidthMonitor: function () {
        my.panelOpenAllowed = typeof parent.window.innerWidth !== "undefined" && parent.window.innerWidth >= my.panelOpenMinWindowWidth && !my.panelClosedManually ? true : false;
      },

      /**
       * Language Translation Tools
       *
       *  @return void
       */
      tr: function () {
        const me = {
          _parent: this,
          _appRootId: "#SplGeotabMapResetBtn",

          _appInit: true,
          _appRootElemObj: null,

          _langDB: null,
          _toLang: null,

          _autoTrIds: [
            "reset_btn_title",
          ],

          _init: function (toLang) {
            console.log("--- APP LANGUAGE " + (me._appInit ? "USED BY DEFAULT" : "SWITCHED TO") + " [ " + toLang + " ]");

            // Error Handling
            if (typeof window.splgeotabmap === "undefined" ||
              typeof window.splgeotabmap.lang === "undefined" ||
              typeof window.splgeotabmap.lang[toLang] === "undefined") {
              console.log("--- ERROR!!! Cannot switch to language [ " + toLang + " ].... Language Not Found");
              return;
            }

            me._toLang = toLang;
            me._langDB = window.splgeotabmap.lang[toLang];
            me._appRootElemObj = my.elt.querySelector(me._appRootId);
          },

          _translateInlineElements: function () {
            if (!me._langDB) {
              return;
            }
            me._appRootElemObj.querySelectorAll("[translate]").forEach((el) => {
              const trVal = el.getAttribute("translate");
              const trArr = trVal.split("|");
              const elAttrName = trArr[0];
              const trId = trArr[1];

              // Translate element attribute value
              el.setAttribute(elAttrName, me.t(trId));
            });
          },

          _translateStaticHTML: function () {
            if (!me._langDB) {
              return;
            }
            for (const i in me._autoTrIds) {
              const id = me._autoTrIds[i];
              const trVal = me.t(id);
              const el = me._appRootElemObj.querySelector("#" + id);
              if (el && trVal) {
                el.innerHTML = trVal;
              }
            }
          },

          _decodeHtmlCharacterEntities: function (html) {
            const txtAreaObj = document.createElement("textarea");
            txtAreaObj.innerHTML = html;
            return txtAreaObj.value;
          },

          t: function (id) {
            // Lib has not been switched(), therefore use default language
            if (!me._langDB && me._appInit) {
              me._init(my.defaultLanguage);
              if (!me._langDB) {
                return "";
              }
              return me.t(id);
            }

            // If token found, look for something to search/replace in translation
            const args = Array.prototype.slice.call(arguments);
            const trVal = typeof me._langDB[id] !== "undefined" ? me._langDB[id] : "";
            args.shift(); // Remove id from arguments
            if (args.length && trVal && trVal.indexOf("{") > -1) {
              args.forEach(arg => {
                if (arg.length === 2) {
                  const tokenKey = arg[0];
                  const tokenVal = arg[1];
                  trVal = trVal.replace(tokenKey, tokenVal);
                }
              });
            }
            return me._decodeHtmlCharacterEntities(trVal);
          },

          langTokens: function (html) {
            if (!me._langDB) {
              return;
            }
            html.match(/{(.*?)}/g).map(function (tokenStr) {
              const id = tokenStr.replace("{", "").replace("}", "");
              html = html.replace(tokenStr, me.t(id));
            });
            return html;
          },

          switchTo: function (toLang) {
            me._appInit = false;
            me._init(toLang);
            me._translateInlineElements();
            me._translateStaticHTML();
          }
        };
        return me;
      }.bind(this)()
    };
    return me;
  }.bind(this)();
};

/**********************************************************************************
 * Make asyncronous AJAX call using JSON to PHP backend
 * Expect JSON response on success or error
 */
const INITSplAPI = function (serverUrl, csrfToken) {
  const me = this; // required from within methods used as callbacks

  // private variables & methods
  this._url = null;
  this._debug = false; // Show debugging information (in Chrome dev tools, Firebug, etc.)
  this._timeout = 0; // How long to wait for a response from the server (in seconds); 0 (or null) means no timeout.
  this._csrfToken = null;

  /**
   *  Make asyncronous AJAX call using JSON to PHP backend
   */
  this.requestService = function (params, callbackSuccess, callbackError) {
    if (me._debug) {
      console.log("InitAPI(requestService) - callXHR(BEGIN)");
    }
    return me.callXHR(params, callbackSuccess, callbackError);
  };

  /**
   *  Utility Handler for making AJAX Calls
   */
  this.callXHR = function (params, callbackSuccess, callbackError) {
    const xhr = new XMLHttpRequest();
    const getPost = typeof params.options !== "undefined" && typeof params.options.method !== "undefined" && params.options.method === "GET" ? "GET" : "POST";
    const url = typeof params.options !== "undefined" && typeof params.options.url !== "undefined" && params.options.url !== "" ? params.options.url : me._url;
    const payload = typeof params.options !== "undefined" && typeof params.options.json !== "undefined" && params.options.json !== "" ? params.options.json : params;

    xhr.open(getPost, url, true);
    xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    xhr.withCredentials = true;
    if (me._csrfToken) {
      xhr.setRequestHeader("X-CSRF-Token", me._csrfToken);
    }
    xhr.addEventListener("abort", function (e) {
      if (callbackError) {
        if (me._debug) {
          console.log("InitAPI(callXHR) - FAILURE-callbackError(Cancelled)");
        }
        callbackError("Cancelled", e);
      }
    });
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          if (me._debug) {
            console.log("InitAPI(callXHR) - SUCCESS(Response 200)");
          }
          // eslint-disable-next-line one-var
          let data, error, result;
          try {
            data = JSON.parse(xhr.responseText);
            if (data && data.error) {
              if (me._debug) {
                console.log("InitAPI(callXHR) - FAILURE(data.error FOUND)");
              }
              error = data.error;
              me.debugLog("ERROR", error);
              me.handleError(error, callbackError);
            } else {
              if (data && data.result) {
                result = data.result;
                if (me._debug) {
                  console.log("InitAPI(callXHR) - SUCCESS(DATA.RESULT FOUND)");
                }
                me.debugLog("SUCCESS", { result: result });
                callbackSuccess(result);
              } else if (typeof data !== "undefined" && data !== "") {
                if (me._debug) {
                  console.log("InitAPI(callXHR) - SUCCESS(DATA FOUND)");
                }
                me.debugLog("SUCCESS", { result: data });
                callbackSuccess(data);
              }
            }
          } catch (e) {
            if (me._debug) {
              console.log("InitAPI(callXHR) - FAILURE(XHR ERROR-1)");
            }
            if (me._debug) {
              console.log(e);
            }
            me.handleError(e, callbackError);
          }
        } else {
          if (me._debug) {
            console.log("InitAPI(callXHR) - FAILURE(XHR ERROR-2)");
          }
          me.debugLog("ERROR", xhr);
          me.handleError(xhr, callbackError);
        }
      }
    };
    let jsonString;
    try {
      jsonString = JSON.stringify(payload);
    } catch (e) {
      if (me._debug) {
        console.log("InitAPI(callXHR) - FAILURE(JSON.stringify ERROR)");
      }
      me.handleError(e, callbackError);
      return;
    }
    if (me._timeout) {
      xhr.timeout = me._timeout * 1000;
    }
    if (me._debug) {
      console.log("InitAPI(callXHR) - SEND");
    }
    xhr.send(jsonString);
    return {
      abort: function () {
        if (me._debug) {
          console.log("InitAPI(callXHR) - ABORT");
        }
        xhr.abort();
      },
    };
  };

  /**
   *  Logs some debug information to the browser console, if _debug is true
   *  @private
   */
  this.debugLog = function () {
    if (me._debug) {
      const logs = [new Date()];
      logs.push.apply(logs, arguments);
      console.log.apply(console, logs);
    }
  };

  /**
   *  Normalizes and handles errors
   *  @private
   *  @param {Object} [error] The error object
   *  @callback {failureCallback} [errorCallback] The function to call once the error has been normalize.
   *                                                  It passes back a string for a known error, and the raw error
   *                                                  object if some custom handling is required.
   */
  this.handleError = function (error, errorCallback) {
    let errorString;
    if (error && error.name && error.message) {
      errorString = error.name + ": " + error.message;
    } else if (error.target || (error instanceof XMLHttpRequest && error.status === 0)) {
      errorString = "Network Error: Couldn't connect to the server. Please check your network connection and try again.";
    }
    if (me._debug) {
      console.error(errorString, error);
    }
    if (errorCallback) {
      errorCallback(errorString || "Error", error);
    }
  };

  /**
   *  Handler for Setting _debug
   */
  this.enableDebug = function (enable) {
    me._debug = enable;
  };

  /**
   *  INIT - Constructor, When an instance gets created
   *
   *  @return string
   */
  this.configure = function (url, csrfToken) {
    const me = this;
    if (typeof url !== "undefined" && typeof url !== "") {
      me._url = url;
    }
    if (typeof csrfToken !== "undefined" && typeof csrfToken !== "") {
      me._csrfToken = csrfToken;
    }
  };

  this.configure(serverUrl, csrfToken);
};

/**********************************************************************************
 *  StartanLync library for searching Geotab for TempTrac / TPMS sensor data
 */
const INITSplSessionMgr = function (myApi, credentials) {
  //
  // Register Add-In session with SpartanLync backend service
  //

  /**
   *  Private Variables
   */
  this._api = null;
  this._credentials = null;

  this._storage = null;
  this._callback = null;
  this._errorCallback = null;

  /**
   * getSettings() Fetch any saved storage settings
   *
   * @param {function} callback - Handler for post-retrieval
   *
   * @return {object}  storageObj - data store in DB or NULL if empty
   *
   */
  this.getSettings = function (callback, errorCallback) {
    const me = this;
    if (!callback || typeof callback !== "function" || !me._api || !me._credentials) {
      return;
    }

    me._callback = callback;
    me._errorCallback = errorCallback && typeof errorCallback === "function" ? errorCallback : null;
    me._api.requestService(
      {
        settings: {
          cmd: "get",
        },
        credentials: me._credentials,
      },
      (result) => {
        if (me._isSuccess(result) && result.data !== null && result.data) {
          const settings = result.data;
          if (typeof settings.storageObj !== "undefined" && typeof settings.deviceIdDb !== "undefined") {
            // If flash message from server exists,
            // pass it forward for user notification after App inits
            if (typeof result.msg !== "undefined" && result.msg) {
              serverFlashMessage = result.msg;
            }
            me._callback(settings.storageObj, settings.deviceIdDb);
          } else {
            me._handleAppError(result, '---- splSessionMgr(): getSettings(): ERROR: RESPONSE MISSING PROPERTY ".storageObj" ----');
          }
        } else {
          me._handleAppError(result, "---- splSessionMgr(): getSettings(): FETCHING ERROR ----");
        }
      },
      // API ERROR FETCHING
      (result) => {
        const msg = "---- splSessionMgr(): getSettings(): API ERROR FETCHING: " + result;
        if (me._errorCallback) {
          me._errorCallback(msg);
        }
      }
    );
  };

  /**
   * syncSettings() Store latest copy of storage settings with backend DB
   *
   * @param {object}   storageObj - data to store in DB
   * @param {function} callback - Handler for post-syncing
   *
   * @return {boolean} accepted: TRUE  - supplied storageObj was saved succesfully
   *                                     Returns local storageObj as valid
   *                             FALSE - supplied storageObj was rejected as expired or invalid.
   *                                     Returns remote storageObj as valid
   * @return {object}  storageObj: Valid storageObj for Add-In usage and local browser storage
   */
  this.syncSettings = function (storageObj, splDeviceIdDB, callback, errorCallback) {
    const me = this;
    if (!storageObj || typeof storageObj !== "object" || !splDeviceIdDB || typeof splDeviceIdDB !== "object" || !callback || typeof callback !== "function" || !me._api || !me._credentials) {
      return;
    }

    me._callback = callback;
    me._errorCallback = errorCallback && errorCallback === "function" ? errorCallback : null;
    me._storage = storageObj;
    me._api.requestService(
      {
        settings: {
          cmd: "set",
          storage: storageObj,
          deviceids: splDeviceIdDB,
        },
        credentials: me._credentials,
      },
      (result) => {
        if (me._isSuccess(result)) {
          const settings = result.data;
          if (typeof settings.accepted !== "undefined" && typeof settings.storageObj !== "undefined" && typeof settings.deviceIdDb !== "undefined") {
            me._callback(settings.accepted, settings.storageObj, settings.deviceIdDb);
          } else {
            me._handleAppError(result, '---- splSessionMgr(): syncSettings(): ERROR: RESPONSE MISSING PROPERTIES ".accepted" AND ".storageObj" ----');
          }
        } else {
          me._handleAppError(result, "---- splSessionMgr(): syncSettings(): ERROR SAVING ----");
        }
      },
      // API ERROR SYNCING
      (result) => {
        console.log("---- splSessionMgr(): syncSettings(): API ERROR SYNCING ----");
        console.log(result);
      }
    );
  };

  /**
  * getTempTracFaults() Fetch TempTrac Fault data
  *
  * @param {string}   vehId - Geotab Vehicle Id to search
  * @param {string}   fromDate - Search FROM date in UTC
  * @param {string}   toDate - Search TO date in UTC
  * @param {string}   tempThreshold - TempTrac Search Threshold Type ("fridge" or "freezer")
  * @param {function} callback - Handler for post-retrieval
  * @param {function} errorCallback - Handler for error reporting
  *
  * @return {array}   FaulsArray - Temptrac Faults found within date range or NULL if empty
  *
  */
  this.getTempTracFaults = function (vehId, fromDate, toDate, tempThreshold, callback, errorCallback) {
    const me = this;
    if (!callback || typeof callback !== "function" || !me._api || !me._credentials) { return; }

    const errCallback = errorCallback && typeof errorCallback === "function" ? errorCallback : null;
    me._api.requestService(
      {
        temptracfaults: {
          vehId: vehId,
          fromDate: fromDate,
          toDate: toDate,
          tempThreshold: tempThreshold,
          noHistoryLatestOnly: true
        },
        credentials: me._credentials
      },
      (result) => {
        if (me._isSuccess(result)) {
          callback(result.data);
        }
        else {
          me._handleAppError(result, "---- splSessionMgr(): getTempTracFaults(): FETCHING ERROR ----");
        }
      },
      // API ERROR FETCHING
      (result) => {
        const msg = "---- splSessionMgr(): getTempTracFaults(): API ERROR FETCHING: " + result;
        if (errCallback) {
          errCallback(msg);
        }
      }
    );
  };

  /**
   *  Handler for Setting debug in SplAPI
   */
  this.enableDebug = function (enable) {
    const me = this;
    me._api.enableDebug(enable);
  };

  /**
   *  Utility Methods
   */

  this._isSuccess = function (result) {
    if (
      typeof result !== "undefined" &&
      result !== null &&
      typeof result === "object" &&
      typeof result.responseStatus !== "undefined" &&
      result.responseStatus !== null &&
      typeof result.responseStatus &&
      result.responseStatus === "success" &&
      typeof result.data !== "undefined"
    ) {
      return true;
    }
    return false;
  };

  this._handleAppError = function (result, msg) {
    const me = this;
    const outMsg = msg || "";
    console.log(msg);
    if (
      typeof result !== "undefined" &&
      result !== null &&
      typeof result === "object" &&
      typeof result.responseStatus !== "undefined" &&
      result.responseStatus !== null &&
      typeof result.responseStatus &&
      result.responseStatus === "failure" &&
      typeof result.msg !== "undefined" &&
      result.msg !== null &&
      result.msg
    ) {
      outMsg += "\n" + result.msg;
      console.log(result.msg);
    } else {
      console.log(result);
      outMsg += "\n" + JSON.stringify(result);
    }
    if (me._errorCallback) {
      me._errorCallback(outMsg);
    }
  };

  /**
   *  INIT - Constructor, When an instance gets created
   *
   *  @return string
   */

  this.configure = function (myApi, myCreds) {
    if (myApi && typeof myApi === "object") {
      this._api = myApi;
    }
    if (myCreds && typeof myCreds === "object") {
      this._credentials = myCreds;
    }
  };

  this.configure(myApi, credentials);
};

/**********************************************************************************
 *  SpartanLync lib for searching Geotab for TempTrac / TPMS sensor data
 *  and Vehicle Fault and Ignition data
 *
 */
/* eslint-disable complexity */
/* eslint-disable camelcase */
const INITGeotabTpmsTemptracLib = function (api, retrySearchRange, repeatingSearchRange, retryFaultSearchRange, repeatingFaultSearchRange) {
  return function () {
    const me = {
      /**
       *  Private Variables
       */
      _timer: {},

      _diagIdsLocalStorageKeyName: "Spl_diagIds_storage",
      _diagIdsLocalStorageVersion: "1.2",
      _diagIdsLocalStorageAge: 345600, // Time (in seconds) before refreshing geotab database Diagnostic IDs from Geotab API. (Default 96 hours)

      _api: api,
      _apiFaultFirstTimeCall: true,
      _apiFirstTimeCall: true,

      _apiCallFaultRetryCount: 0,
      _apiCallRetryCount: 0,

      _devId: null,
      _devConfig: {},
      _devSelectedComp: "",
      _devComponents: {
        ids: "tractor,trailer1,trailer2,trailer3",
        names: {
          tractor: "Tractor",
          trailer1: "Trailer 1",
          trailer2: "Dolly",
          trailer3: "Trailer 2"
        },
        diagIds: {
          byName: {
            tractor: "Tractor tire location",
            trailer1: "Trailer 1 tire location",
            trailer2: "Trailer 2 tire location",
            trailer3: "Trailer 3 tire location"
          },
          byIds: {}
        },
        deviceIds: {
          byName: {
            tractor: "Peripheral device: tractor ID",
            trailer1: "Peripheral device: trailer 1 ID",
            trailer2: "Peripheral device: trailer 2 ID",
            trailer3: "Peripheral device: trailer 3 ID"
          },
          byIds: {}
        },
        idsLoaded: false
      },
      _diagIdsLoadedCallbacks: [],

      _tpmsAlerts: {
        "aKLJDxjee7kuoKR9UxakwaA": {
          name: "Missing Sensor",
          type: "Sensor Fault",
          trId: "alert_missing_sensor",
          color: "RED"
        },
        "DiagnosticVehicleBatteryLowVoltageId": {
          name: "Vehicle Battery has LOW Voltage",
          type: "Battery Fault",
          trId: "alert_battery_low_voltage",
          color: "AMBER"
        },

        "aZOW3ovi390i98yF2ZKR1qg": {
          name: "Leak Detected",
          type: "Tire Pressure Fault",
          trId: "leak_detected",
          color: "RED"
        },
        "aDXwtFQfg4EKkLSFd5Hs2rA": {
          name: "Extreme Over Pressure",
          type: "Tire Pressure Fault",
          trId: "alert_pressure_extreme_over",
          color: "RED"
        },
        "aZStc9p8eaUi8_ORP7eZ8eQ": {
          name: "Extreme Under Pressure",
          type: "Tire Pressure Fault",
          trId: "alert_pressure_extreme_under",
          color: "RED"
        },
        "ak1udf2L2UEemAp833dbAZQ": {
          name: "Over Temperature",
          type: "Tire Temperature Fault",
          trId: "alert_temperature_over",
          color: "AMBER"
        },
        "alCsVoz4p50ap9rPVxYnr_A": {
          name: "Over Pressure",
          type: "Tire Pressure Fault",
          trId: "alert_pressure_over",
          color: "AMBER"
        },
        "alDp49zHqz0eqtLawXDYc_g": {
          name: "Under Pressure",
          type: "Tire Pressure Fault",
          trId: "alert_pressure_under",
          color: "AMBER"
        }
      },

      _vehIgnitionData: null,

      _sDataCallback: null,
      _fDataCallback: null,

      _fromDate: null,
      _toDate: null,

      _fromFaultDate: null,
      _toFaultDate: null,

      _repSType: null,
      _repCallback: null,

      _timeRangeForRepeatSearchesInSeconds: repeatingSearchRange,
      _timeSearchRetryRangeInDays: retrySearchRange,

      _timeRangeForRepeatFaultSearchesInSeconds: repeatingFaultSearchRange,
      _timeFaultSearchRetryRangeInDays: retryFaultSearchRange,

      /**
       * getData() Retrieves TPMS /Temptrac sensor data from Geotab API
       *
       * @param {string} devId    - Geotab Device Id
       * @param {string} devComp  - Vehicle component (null = all/any, tractor, trailer1, dolly, trailer2)
       * @param {string} callback - Callback func to invoke upon retrieval of data
       * @param {boolean} firstTimeCallOverride - Manually override firstTime/repeat behaviour
       *
       * If first call, start with a search over last 24 hours.
       * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
       * - If sensor data found,
       *   (1) convert sensor data to a time-sorted array of sensor objects and
       *   (2) pass back to supplied callback function
       *
       * @return {array} Array of Sensor objects, sorted by time from oldest to newest
       */
      getData: function (devId, devComp, callback, firstTimeCallOverride) {
        if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
          return;
        }
        if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
          me._apiFirstTimeCall = firstTimeCallOverride;
        }
        me._devId = devId;
        me._devSelectedComp = devComp;
        me._sDataCallback = callback;
        me._setDateRangeAndInvokeCall();
      },

      /**
      * getFaults() Retrieves Vehicle faults and ignition data from Geotab API
      *
      * @param {string} devId    - Geotab Device Id
      * @param {string} callback - Callback func to invoke upon retrieval of fault data
      *
      * If first call, start with a search over last 24 hours.
      * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
      * - If sensor data found,
      *   (1) convert sensor data to a time-sorted array of sensor objects and
      *   (2) pass back to supplied callback function
      *
      * @return {array} Array of Fault objects, sorted by time from oldest to newest
      * @return {array} Array of Ignition data objects, sorted by time from oldest to newest
      */
      getFaults: function (devId, callback, firstTimeCallOverride) {
        if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
          return;
        }
        if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
          me._apiFaultFirstTimeCall = firstTimeCallOverride;
        }
        me._devId = devId;
        me._fDataCallback = callback;
        me._buildDiagIdLib().then(() => {
          me._buildDiagIdDB();
          me._setDateRangeAndInvokeFaultCalls();
        });
      },

      getVehComponentDB: function () {
        return me._devComponents;
      },

      getTpmsAlerts: function () {
        return me._tpmsAlerts;
      },

      resetAsFirstTime: function () {
        me._devId = null;
        me._devConfig = {};
        me._devSelectedComp = "";
        me._apiCallFaultRetryCount = 0;
        me._apiCallRetryCount = 0;
        me._apiFirstTimeCall = true;
        me._apiFaultFirstTimeCall = true;
        me._vehIgnitionData = null;
      },

      resetForNewVehComponent: function () {
        me._devId = null;
        me._devSelectedComp = "";
        me._apiCallFaultRetryCount = 0;
        me._apiCallRetryCount = 0;
        me._apiFirstTimeCall = true;
        me._apiFaultFirstTimeCall = true;
        me._vehIgnitionData = null;
      },

      onDiagIdsLoaded: function (callback) {
        if (typeof callback === "function") {
          // If DeviceIds loaded, invoke Callback
          if (me._devComponents.loaded) {
            callback(me._devComponents);
          }
          // Otherwise, Queue it for after DeviceIds are loaded
          else {
            me._diagIdsLoadedCallbacks.push(callback);
          }
        }
      },

      _setDateRangeAndInvokeFaultCalls: function () {
        me._toFaultDate = moment().utc().format();

        // First call, search for data over last few days
        if (me._apiFaultFirstTimeCall) {

          // If retry limit is reached without fault data, send a failure response to callback func
          if (me._apiCallFaultRetryCount === me._timeFaultSearchRetryRangeInDays.length) {
            me._apiCallFaultRetryCount = 0;
            me._fDataCallback(null, me._vehIgnitionData);
            return;
          }
          // Iterate date range array USING _apiCallFaultRetryCount until a successful API response
          me._fromFaultDate = moment().utc().subtract(me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount], "day").format();
        }
        // Repeat call, search over the last few minutes
        else {
          me._fromFaultDate = moment().utc().subtract(me._timeRangeForRepeatFaultSearchesInSeconds, "seconds").format();
        }

        // Build then perform TPMS/Temptrac Multicall
        console.log("Please Wait...Attempt#" + (me._apiCallFaultRetryCount + 1) +
          " Retrieving TPMS Fault data on VehicleID [ " + me._devId + " ] using " + (
            me._apiFaultFirstTimeCall ?
              me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount] + " day" :
              me._convertSecondsToHMS(me._timeRangeForRepeatFaultSearchesInSeconds)
          ) + " date range: FROM: " + me._fromFaultDate + " => TO: " + me._toFaultDate);

        // Invoke Get.Fault + Get.TireLocation(Using DiagIds from VehComponentsTable) API Calls
        const apiCall = [
          ["Get", {
            typeName: "FaultData",
            search: {
              fromDate: me._fromFaultDate,
              toDate: me._toFaultDate,
              deviceSearch: {
                id: me._devId
              }
            }
          }],
          ["Get", {
            typeName: "StatusData",
            search: {
              fromDate: me._fromFaultDate,
              toDate: me._toFaultDate,
              deviceSearch: {
                id: me._devId
              },
              diagnosticSearch: {
                id: "DiagnosticIgnitionId"
              }
            }
          }]
        ];
        if (Object.keys(me._devComponents["diagIds"]["byIds"]).length) {
          Object.keys(me._devComponents["diagIds"]["byIds"]).forEach(diagId => {
            apiCall.push(["Get", {
              typeName: "StatusData",
              search: {
                fromDate: me._fromFaultDate,
                toDate: me._toFaultDate,
                deviceSearch: {
                  id: me._devId
                },
                diagnosticSearch: {
                  id: diagId
                }
              }
            }]);
          });
        }

        me._timer.b3 = new Date();
        me._api.multiCall(apiCall)
          .then(function (result) {
            if (result && result.length >= 3) {
              const fromFaultDateUnix = moment(me._fromFaultDate).unix();
              const toFaultDateUnix = moment(me._toFaultDate).unix();
              let faultDataFound = false;
              let tireLocData = {};
              const fdata = {};

              me._timer.b4 = new Date();
              console.log("Fault data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
              console.log("Fault data for VehicleID [ " + me._devId + " ] being analyzed - Please Wait!");

              // Collect Ignition data
              me._vehIgnitionData = me._generateVehIgnitionDb(result[1]);

              // Assemble and merge Tire Location data from multi-vehicle Component query
              for (let i = 2; i < result.length; i++) {
                tireLocData = { ...tireLocData, ...me._generateFaultAxleLocDb(result[i]) };
              }

              // Analyze fault data
              me._timer.b3 = new Date();
              for (const frec of result[0]) {
                const frecDateUnix = moment(frec.dateTime).unix();
                if (!frec.id || frec.device.id !== me._devId || typeof frec.diagnostic.id === "undefined" ||
                  !(frecDateUnix >= fromFaultDateUnix && frecDateUnix <= toFaultDateUnix)) {
                  continue; // Invalid records discarded
                }
                const faultId = frec.diagnostic.id;
                const recObj = {
                  id: faultId,
                  time: frecDateUnix
                };

                // Keep the most recent fault record by time
                if (typeof fdata[faultId] === "undefined") {
                  fdata[faultId] = recObj;
                }
                else if (recObj.time > fdata[faultId].time) {
                  fdata[faultId] = recObj;
                }

                // Attach VehComponent/Axle/Tire location to Fault record (If found in Tire Location DB)
                if (Object.keys(tireLocData).length) {
                  Object.keys(tireLocData).forEach(vehComp => {
                    if (typeof tireLocData[vehComp][fdata[faultId].time] !== "undefined") {
                      const tireLocRec = tireLocData[vehComp][fdata[faultId].time];
                      tireLocRec.vehComp = vehComp;
                      if (typeof fdata[faultId].loc === "undefined") {
                        fdata[faultId].loc = [];
                      }
                      fdata[faultId].loc.push(tireLocRec);
                    }
                  });
                }

                // Attach Alert level to a few Faults (TPMS-related)
                if (typeof fdata[faultId].alert === "undefined" && typeof me._tpmsAlerts[faultId] !== "undefined") {
                  fdata[faultId].alert = me._tpmsAlerts[faultId];
                }

                // Specify whether fault occurred after the most recent ignition
                fdata[faultId].occurredOnLatestIgnition = fdata[faultId].time >= me._vehIgnitionData["on-latest"] ? true : false;

                faultDataFound = true;
              }
              if (!faultDataFound) {
                if (me._apiFaultFirstTimeCall) {

                  // If its a first time call + no fault date found, Retry with a different date range
                  console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND! Retrying search with another date range...");
                  me._apiCallFaultRetryCount++;
                  me._setDateRangeAndInvokeFaultCalls();
                  return;
                }
                else {

                  // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" response to callback
                  console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
                  me._apiCallFaultRetryCount = 0;
                  me._fDataCallback(null, me._vehIgnitionData);
                  return;
                }
              }
              else {
                // Future calls after this successful response will not be a first-timer
                me._apiFaultFirstTimeCall = false;

                // Build API calls for searching for diagnostic descriptions for the Fault Ids found
                const calls = [];
                const faultArr = [];
                if (Object.keys(fdata).length) {
                  for (const faultId in fdata) {
                    if (fdata.hasOwnProperty(faultId)) {
                      calls.push(["Get", {
                        typeName: "Diagnostic",
                        search: {
                          id: faultId
                        }
                      }]);
                    }
                  }

                  // Search for Diagnostic descriptions
                  me._api.multiCall(calls)
                    .then(function (result) {
                      if (result && result.length) {
                        for (const res of result) {
                          if (Array.isArray(res) && res.length) {
                            for (const frec of res) {
                              if (typeof frec.name === "undefined" || !frec.id ||
                                typeof fdata[frec.id] === "undefined") {
                                continue; // Invalid / missing records discarded
                              }
                              fdata[frec.id].msg = frec.name;
                              faultArr.push(fdata[frec.id]);
                            }
                          }
                          else if (typeof res === "object" &&
                            typeof res.name !== "undefined" &&
                            typeof res.id !== "undefined" &&
                            res.id !== "" && res.id !== null &&
                            typeof fdata[res.id] !== "undefined"
                          ) {
                            fdata[res.id].msg = res.name;
                            faultArr.push(fdata[res.id]);
                          }
                        }

                        me._timer.b4 = new Date();
                        console.log("Fault data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000) + ".");

                        // Return fault data to callback
                        me._apiCallFaultRetryCount = 0;
                        me._fDataCallback(faultArr, me._vehIgnitionData);
                        return;
                      }
                      else {
                        if (me._apiFaultFirstTimeCall) {
                          me._apiCallFaultRetryCount++;
                          me._setDateRangeAndInvokeFaultCalls();
                          return;
                        }
                        // Return "NOT-FOUND" result to callback
                        me._apiCallFaultRetryCount = 0;
                        me._fDataCallback(null, me._vehIgnitionData);
                      }
                    })
                    .catch(() => {
                      if (me._apiFaultFirstTimeCall) {
                        me._apiCallFaultRetryCount++;
                        me._setDateRangeAndInvokeFaultCalls();
                        return;
                      }

                      // Return "NOT-FOUND" result to callback
                      me._apiCallFaultRetryCount = 0;
                      me._fDataCallback(null, me._vehIgnitionData);
                    });
                }
                else {
                  if (me._apiFaultFirstTimeCall) {
                    me._apiCallFaultRetryCount++;
                    me._setDateRangeAndInvokeFaultCalls();
                    return;
                  }

                  // Return "NOT-FOUND" result to callback
                  me._apiCallFaultRetryCount = 0;
                  me._fDataCallback(null, me._vehIgnitionData);
                }
              }
            }
            // No results from API Call, Retry
            else {

              // Retry if its a first time call
              if (me._apiFaultFirstTimeCall) {
                me._apiCallFaultRetryCount++;
                me._setDateRangeAndInvokeFaultCalls();
                return;
              }

              // Return "NOT-FOUND" result to callback
              console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
              me._apiCallFaultRetryCount = 0;
              me._fDataCallback(null, me._vehIgnitionData);
            }
          })
          .catch((errorString) => {
            me._timer.b4 = new Date();
            console.log("--- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
            console.log("--- Error: getFaults.api.multiCall(): " + errorString);

            // Retry if its a first time call
            if (me._apiFaultFirstTimeCall) {
              me._apiCallFaultRetryCount++;
              me._setDateRangeAndInvokeFaultCalls();
              return;
            }

            // Return "NOT-FOUND" result to callback
            me._apiCallFaultRetryCount = 0;
            me._fDataCallback(null, me._vehIgnitionData);
          });
      },

      _setDateRangeAndInvokeCall: function () {
        let vehComps = "";
        me._toDate = moment().utc().format();

        // First call, search for data over last few days
        if (me._apiFirstTimeCall) {
          // If retry limit is reached without sensor data, send a failure response to callback func
          if (me._apiCallRetryCount === me._timeSearchRetryRangeInDays.length) {
            me._apiCallRetryCount = 0;
            me._sDataCallback(null);
            return;
          }

          // Iterate date range array USING _apiCallRetryCount until a successful API response
          me._fromDate = moment().utc().subtract(me._timeSearchRetryRangeInDays[me._apiCallRetryCount], "day").format();
        }
        // Repeat call, search over the last few minutes
        else {
          me._fromDate = moment().utc().subtract(me._timeRangeForRepeatSearchesInSeconds, "seconds").format();
        }
        // Search for all Vehicle componenents, if a specific component not specified
        vehComps = me._devSelectedComp ? me._devSelectedComp : me._devComponents.ids;

        // Build then perform TPMS/Temptrac Multicall
        console.log(
          "Please Wait...Attempt#" +
          (me._apiCallRetryCount + 1) +
          " Retrieving " +
          (me._devSelectedComp ? me._devComponents.names[me._devSelectedComp].toUpperCase() : "ALL") +
          " Sensor Data on VehicleID [ " +
          me._devId +
          " ] using " +
          (me._apiFirstTimeCall ? me._timeSearchRetryRangeInDays[me._apiCallRetryCount] + " day" : me._convertSecondsToHMS(me._timeRangeForRepeatSearchesInSeconds)) +
          " date range: FROM: " +
          me._fromDate +
          " => TO: " +
          me._toDate
        );

        me._timer.b1 = new Date();
        me._buildApiCall(vehComps).then((calls) => {
          me._api.multiCall(calls)
            .then(function (result) {
              if (result && result.length) {
                const fromDateUnix = moment(me._fromDate).unix();
                const toDateUnix = moment(me._toDate).unix();
                let sensorDataFound = false;
                const sdata = {};

                me._timer.b2 = new Date();
                console.log("Sensor data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));

                // Analyze and Sort sensor data
                console.log("Sensor data for VehicleID [ " + me._devId + " ] being analyzed - Please Wait!");
                me._timer.b1 = new Date();
                for (const res of result) {
                  if (Array.isArray(res) && res.length) {
                    for (const srec of res) {
                      const srecDateUnix = moment(srec.dateTime).unix();
                      if (
                        !srec.id ||
                        !srec.dateTime ||
                        srec.device.id !== me._devId ||
                        typeof srec.diagnostic.id === "undefined" ||
                        !(srecDateUnix > fromDateUnix && srecDateUnix < toDateUnix)
                      ) {
                        continue; // Invalid records discarded
                      }
                      const diagName = me._locLib.idxIds[srec.diagnostic.id];
                      const vehCompType = me._locLib[diagName].type;

                      // Init Sensor Data ordered by Vehicle component
                      if (typeof sdata[vehCompType] === "undefined") {
                        sdata[vehCompType] = {
                          tpmstemp: {},
                          tpmspress: {},
                          temptrac: {},
                        };
                      }

                      // Store Temptrac sensor reading
                      if (diagName.indexOf("reefer temperature") > -1) {
                        const zone = me._extractZoneFromLoc(diagName);
                        const locId = "temptrac_" + zone.trim().replace(/ /g, "").toLowerCase();
                        const recObj = {
                          id: locId,
                          type: "Temptrac",
                          time: srecDateUnix,
                          zone: zone,
                          val: me._fromDataToValueObj(srec),
                        };

                        // Remember most recent records by Location
                        if (typeof sdata[vehCompType].temptrac[locId] === "undefined") {
                          sdata[vehCompType].temptrac[locId] = recObj;
                        } else if (recObj.time > sdata[vehCompType].temptrac[locId].time) {
                          sdata[vehCompType].temptrac[locId] = recObj;
                        }
                      }
                      // Store TPMS Temperature sensor reading
                      else if (diagName.indexOf("ire temperature:") > -1) {
                        const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                        const locId = "tiretemp_" + axle.trim().replace(/ /g, "").toLowerCase();
                        const recObj = {
                          id: locId,
                          type: "Tire Temperature",
                          time: srecDateUnix,
                          axle: axle,
                          val: me._fromDataToValueObj(srec),
                        };

                        // Remember most recent records by Location
                        if (typeof sdata[vehCompType].tpmstemp[locId] === "undefined") {
                          sdata[vehCompType].tpmstemp[locId] = recObj;
                        } else if (recObj.time > sdata[vehCompType].tpmstemp[locId].time) {
                          sdata[vehCompType].tpmstemp[locId] = recObj;
                        }
                      }
                      // Store TPMS Pressure sensor reading
                      else if (diagName.indexOf("ire pressure:") > -1) {
                        const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                        const locId = "tirepress_" + axle.trim().replace(/ /g, "").toLowerCase();
                        const recObj = {
                          id: locId,
                          type: "Tire Pressure",
                          time: srecDateUnix,
                          axle: axle,
                          val: me._fromDataToValueObj(srec),
                        };

                        // Remember most recent records by Location
                        if (typeof sdata[vehCompType].tpmspress[locId] === "undefined") {
                          sdata[vehCompType].tpmspress[locId] = recObj;
                        } else if (recObj.time > sdata[vehCompType].tpmspress[locId].time) {
                          sdata[vehCompType].tpmspress[locId] = recObj;
                        }
                      }
                      sensorDataFound = true;
                    }
                  }
                }

                if (!sensorDataFound) {
                  if (me._apiFirstTimeCall) {
                    // If its a first time call + no sensor date found, Retry with a different date range
                    console.log("NO SENSOR DATA FOUND on VehicleID [ " + me._devId + " ]! Retrying search with another date range...");
                    me._apiCallRetryCount++;
                    me._setDateRangeAndInvokeCall();
                    return;
                  } else {
                    // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" response to callback
                    me._apiCallRetryCount = 0;
                    me._sDataCallback(null);
                    return;
                  }
                } else {
                  me._timer.b2 = new Date();
                  console.log("Sensor data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000) + ".");

                  if (!me._devSelectedComp) {
                    // Search results for the Entire Vehicle Train chooses the highest-priority vehicle component found in search results
                    const vehCompsFound = Object.keys(sdata);
                    if (vehCompsFound.length === 1) {
                      me._devSelectedComp = vehCompsFound[0];
                    } else {
                      for (const comp of me._devComponents.ids.split(",")) {
                        if (vehCompsFound.includes(comp)) {
                          me._devSelectedComp = comp;
                          break;
                        }
                      }
                    }

                    // Build vehicle component configuration, returned on future search results
                    me._devConfig = {
                      ids: vehCompsFound,
                      total: vehCompsFound.length,
                      compsdata: sdata,
                    };
                  }
                  me._devConfig.active = me._devSelectedComp;

                  // Future calls after this successful response will not be a first-timer
                  me._apiFirstTimeCall = false;

                  // Return sensor data for single Vehicle component to UI callback
                  me._apiCallRetryCount = 0;
                  const compdata = JSON.parse(JSON.stringify(sdata[me._devSelectedComp]));
                  compdata.vehId = me._devId;
                  compdata.vehCfg = me._devConfig;
                  me._sDataCallback(compdata);
                  return;
                }
              }
              // No results from multicall, Retry
              else {
                me._apiCallRetryCount++;
                me._setDateRangeAndInvokeCall();
                return;
              }
            })
            .catch((errorString) => {
              me._timer.b2 = new Date();
              console.log("--- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));
              console.log("--- Error: getData.api.multiCall(): " + errorString);

              // Retry if its a first time call
              if (me._apiFirstTimeCall) {
                me._apiCallRetryCount++;
                me._setDateRangeAndInvokeCall();
              }
            });
        });
      },

      _generateFaultAxleLocDb: function (result) {
        const locData = {};

        if (result && result.length) {
          for (const res of result) {
            if (Array.isArray(res) && res.length) {
              for (const frec of res) {
                if (typeof frec.data === "undefined" ||
                  typeof frec.dateTime === "undefined" ||
                  typeof frec.diagnostic === "undefined" ||
                  typeof frec.diagnostic.id === "undefined") {
                  continue; // Invalid / missing records discarded
                }
                const time = moment(frec.dateTime).unix();
                const vehComp = me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] : "unknown";
                if (typeof locData[vehComp] === "undefined") {
                  locData[vehComp] = {};
                }
                locData[vehComp][time] = me._getLocFromGeotabData(frec.data);
              }
            }
            else if (typeof res === "object" &&
              typeof res.data !== "undefined" &&
              typeof res.dateTime !== "undefined" &&
              typeof res.diagnostic !== "undefined" &&
              typeof res.diagnostic.id !== "undefined"
            ) {
              const time = moment(res.dateTime).unix();
              const vehComp = me._devComponents["diagIds"]["byIds"][res.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][res.diagnostic.id] : "unknown";
              if (typeof locData[vehComp] === "undefined") {
                locData[vehComp] = {};
              }
              locData[vehComp][time] = me._getLocFromGeotabData(res.data);
            }
          }
        }
        return locData;
      },

      /**
      * _generateVehIgnitionDb() Stores Ignition Status in Object Db
      *
      * In "data" property;
      * - Ignition on will be indicated by a 1
      * - Ignition off will be indicated by a 0
      *
      * @return {object} structure storing Array of vehicle Ignition organized by ON/OFF status
      */
      _generateVehIgnitionDb: function (result) {
        const ignitionData = {
          "on-latest": 0,
          "on": [],
          "off-latest": 0,
          "off": [],
          "byTime": {},
        };

        if (result && result.length) {
          for (const res of result) {
            if (Array.isArray(res) && res.length) {
              for (const rec of res) {
                if (typeof rec.data === "undefined" ||
                  typeof rec.dateTime === "undefined") {
                  continue; // Invalid / missing records discarded
                }
                const time = moment(rec.dateTime).unix();
                const status = rec.data ? "on" : "off";
                ignitionData[status].push(time);
                ignitionData["byTime"][time] = status;
                ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
                ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
              }
            }
            else if (typeof res === "object" &&
              typeof res.data !== "undefined" &&
              typeof res.dateTime !== "undefined"
            ) {
              const time = moment(res.dateTime).unix();
              const status = res.data ? "on" : "off";
              ignitionData[status].push(time);
              ignitionData["byTime"][time] = status;
              ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
              ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
            }
          }
        }
        return ignitionData;
      },

      _mDimAssign: function (obj, keyPath, value) {
        const lastKeyIndex = keyPath.length - 1;
        for (const i = 0; i < lastKeyIndex; ++i) {
          const key = keyPath[i];
          if (!(key in obj)) {
            obj[key] = {};
          }
          obj = obj[key];
        }
        obj[keyPath[lastKeyIndex]] = value;
      },

      _fromDataToValueObj: function (geotabData) {
        const diagName = me._locLib.idxIds[geotabData.diagnostic.id];
        const unitOfMeasure = me._locLib[diagName].unitOfMeasure;
        const valueObj = {};

        // Temperature conversions from Geotab default celcius to farenheit
        if (unitOfMeasure === "UnitOfMeasureDegreesCelsiusId") {
          valueObj.c = parseInt(geotabData.data);
          valueObj.f = me._celciusToFarenheit(parseInt(geotabData.data));
        }
        // Pressure conversions from Geotab default kPa to psi and bar
        else {
          const kpa = parseInt(geotabData.data) / 1000;
          valueObj.kpa = kpa;
          valueObj.psi = me._kpaToPsi(kpa);
          valueObj.bar = me._kpaToBa(kpa);
        }
        return valueObj;
      },

      _celciusToFarenheit: function (c) {
        return Math.round(((c * 9) / 5 + 32) * 10) / 10; // Round to 1 decimal place;
      },

      _kpaToPsi: function (kpa) {
        return Math.round((kpa / 6.89475729) * 10) / 10;
      },

      _kpaToBa: function (kpa) {
        return Math.round((kpa / 100) * 10) / 10;
      },

      /**
       * _getLocFromGeotabData() Extract and store Axle/Tire loction in Object Db
       *
       * In "data" property;
       * - Axle is an increment of 1 of the HIGH order 4 bits in data byte
       *     e.g. In byte "0010 0011", 0010 or 2 + 1 = Axle 3
       * - Axle is an increment of 1 of the LOW order 4 bits in data byte
       *     e.g. In byte "0010 0011", 0011 or 3 + 1 = Tire 4
       *
       * @return {object} storing Axle/Tire loction
       */
      _getLocFromGeotabData: function (data) {
        return {
          axle: (data >> 4) + 1,
          tire: (data & 0b00001111) + 1,
        };
      },

      _extractZoneFromLoc: function (loc) {
        return loc.split("reefer temperature")[1].trim().replace("zone", "Zone");
      },

      _extractAxleFromLoc: function (loc) {
        return loc.split(":")[1].trim().replace("axle", "Axle").replace("tire", "Tire");
      },

      _getCompFromDiagName: function (diagName) {
        if (diagName.indexOf("railer 1") > -1) {
          return "trailer1";
        }
        else if (diagName.indexOf("railer 2") > -1) {
          return "trailer2";
        }
        else if (diagName.indexOf("railer 3") > -1) {
          return "trailer3";
        }
        else {
          return "tractor";
        }
      },

      _buildDiagIdLib: function () {
        return new Promise(resolve => {

          // Load DiagIDs from Browser local storage
          me._diagIdsLocalStorage.get().then((diagIDsStoreObj) => {
            if (diagIDsStoreObj) {
              console.log("--- buildDiagIdLib(): FOUND Vehicle Diagnostic ID Database");
              me._locLib = diagIDsStoreObj;
              resolve();
            }
            else {
              const calls = [];
              console.log("--- buildDiagIdLib(): Building Vehicle Diagnostic ID Database...");

              // Build Get.Diagnostic API Call for each TPMS/TempTrac location
              for (const comp of Object.keys(me._locLib.idxNames)) {
                for (const loc of me._locLib.idxNames[comp]) {
                  calls.push(["Get", {
                    typeName: "Diagnostic",
                    search: {
                      name: loc,
                      diagnosticType: "GoDiagnostic"
                    }
                  }]);
                }
              }

              // Invoke Get.Diagnostic API Calls
              me._timer.a3 = new Date();
              me._api.multiCall(calls)
                .then((results) => {
                  if (results && results.length) {
                    for (const obj of results) {
                      const res = obj[0];
                      const diagName = res.name;
                      const diagId = res.id;

                      if (typeof me._locLib.idxIds[diagId] === "undefined") {
                        me._locLib.idxIds[diagId] = diagName;
                        me._locLib[diagName] = {
                          loc: diagName,
                          id: diagId,
                          unitOfMeasure: res.unitOfMeasure,
                          type: me._getCompFromDiagName(diagName),
                        };
                      }
                    }

                    // Save to Browser local storage
                    me._diagIdsLocalStorage.set(me._locLib);

                    // Done
                    me._timer.a4 = new Date();
                    console.log("--- buildDiagIdLib(): Built Vehicle Diagnostic ID Database - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000));
                    me._diagIdsLocalStorage.lockClear();
                  }
                  else {
                    console.log("--- buildDiagIdLib(): ERROR: EMPTY RESPONSE - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000));
                  }
                  resolve();
                })
                .catch((errorStr) => {
                  me._timer.a4 = new Date();
                  console.log("--- buildDiagIdLib(): ERROR: Vehicle Diagnostic ID Database build failed - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000) + " - " + errorStr);
                  resolve();
                });
            }
          });
        });
      },

      _buildDiagIdDB: function () {
        if (!me._devComponents.idsLoaded && Object.keys(me._devComponents["diagIds"]["byName"]).length) {

          // Populate _devComponents.diagIds.byIds[] & _devComponents.deviceIds.byIds[] from _locLib
          Object.keys(me._devComponents["diagIds"]["byName"]).forEach(comp => {

            // Build DiagId Reverse-Lookup Table
            const diagName = me._devComponents["diagIds"]["byName"][comp];
            if (typeof me._locLib[diagName] !== "undefined" && typeof me._locLib[diagName].id !== "undefined") {
              me._devComponents["diagIds"]["byIds"][me._locLib[diagName].id] = comp;
            }

            // Build DeviceId Lookup Table
            if (typeof me._devComponents["deviceIds"]["byName"][comp] !== "undefined" &&
              typeof me._locLib[me._devComponents["deviceIds"]["byName"][comp]] !== "undefined" &&
              typeof me._locLib[me._devComponents["deviceIds"]["byName"][comp]].id !== "undefined") {
              me._devComponents["deviceIds"]["byIds"][comp] = me._locLib[me._devComponents["deviceIds"]["byName"][comp]].id;
            }
          });

          // One-time Invoke callbacks waiting on _devComponents.*.byIds[]
          while (me._diagIdsLoadedCallbacks.length && (
            Object.keys(me._devComponents["diagIds"]["byIds"]).length ||
            Object.keys(me._devComponents["deviceIds"]["byIds"]).length
          )) {
            const diagLoadedCallback = me._diagIdsLoadedCallbacks.pop();
            diagLoadedCallback(me._devComponents);
          }
          me._devComponents.idsLoaded = true;
        }
      },

      _buildApiCall: async function (vehComps) {
        const calls = [];
        const vehCompStr = vehComps || me._devComponents.ids.split(",")[0]; // If undefined, only get tractor sensors

        await me._buildDiagIdLib();
        me._buildDiagIdDB();

        for (const comp of vehCompStr.split(",")) {
          for (const loc of me._locLib.idxNames[comp]) {
            const diagId = me._locLib[loc].id;
            calls.push(["Get", {
              typeName: "StatusData",
              search: {
                fromDate: me._fromDate,
                toDate: me._toDate,
                deviceSearch: {
                  id: me._devId
                },
                diagnosticSearch: {
                  id: diagId
                }
              }
            }]);
          }
        }
        return calls;
      },

      _convertSecondsToHMS: function (seconds) {
        const sec = Number(seconds);
        if (sec < 0.01) {
          return "< 0.01 seconds";
        }
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(((sec % 3600) % 60) * 100) / 100;

        const hDisplay = h > 0 ? h + (h === 1 ? " hour" : " hours") : "";
        const mDisplay = m > 0 ? m + (m === 1 ? " minute" : " minutes") : "";
        const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";

        return hDisplay + (hDisplay && mDisplay ? ", " : "") + mDisplay + ((hDisplay || mDisplay) && sDisplay ? ", " : "") + sDisplay;
      },

      _diagIdsLocalStorage: {

        /**
         *  Private Variables
         */
        _lockSuffix: "_lock",
        _lockPollingTime: 1000,   // Time to wait before polling for lock removal
        _lockPollingAttempts: 20, // Amount of attempts to check for lock removal
        _lockTimerCounter: 0,

        /**
         *  Gets data from localStorage
         *  - With lock protection for multiple Async calls to data in local Storage
         *
         *  @returns {*} An object with a property as JS object
         */
        get: async function () {
          const my = this;
          const storageData = my.parseJSON(localStorage.getItem(me._diagIdsLocalStorageKeyName));
          const storageObj = my.validateData(storageData);
          if (storageObj) {
            return storageObj;
          }
          // Check if lock is SET. If yes, poll until results appear or polling expires
          else if (my.isLockSet()) {
            await my.lockPoll();
            const storageData = my.parseJSON(localStorage.getItem(me._diagIdsLocalStorageKeyName));
            const storageObj = my.validateData(storageData);
            return storageObj;
          }
          // No Data and Lock is NOT SET, so set it while data is retrieved
          else {
            my.lockSet();
            return storageObj;
          }
        },

        validateData: function (storageData) {
          const my = this;
          const now = moment().utc().unix();
          let storageObj = null;
          if (storageData) {
            if (typeof storageData.ver !== "undefined" && typeof storageData.expiry !== "undefined" &&
              storageData.ver === me._diagIdsLocalStorageVersion && storageData.expiry > now) {
              storageObj = storageData;
            }
          }
          return storageObj;
        },

        /**
         *  Saves data into localStorage
         *  @param {data} data The data object
         */
        set: function (storageData) {
          const my = this;

          // Set Version
          if (!storageData || typeof storageData.idxNames === "undefined") {
            return;
          }
          else if (typeof storageData.ver === "undefined") {
            storageData.ver = me._diagIdsLocalStorageVersion;
          }

          // Set timestamp of Expiry of this local Storage object
          storageData.expiry = moment().utc().add(me._diagIdsLocalStorageAge, "seconds").unix();

          // Attempt to Save Remotely
          localStorage.setItem(me._diagIdsLocalStorageKeyName, JSON.stringify(storageData));
        },

        parseJSON: function (raw) {
          try {
            json = JSON.parse(raw);
          } catch (e) {
            // Malformed JSON
            return null;
          }
          return json;
        },

        /**
         *  Routines for managing a Semaphore Lock in memory
         *  - Preventing multiple Async calls from performing expensive data fetching operation from Geotab API
         */

        isLockSet: function () {
          const my = this;
          const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
          const lockStartUnix = typeof window[lockLocalStorageKeyName] === "undefined" ? null : window[lockLocalStorageKeyName];
          return lockStartUnix ? true : false;
        },

        lockSet: function () {
          const my = this;
          const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
          window[lockLocalStorageKeyName] = moment().utc().unix();
        },

        lockClear: function () {
          const my = this;
          const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
          delete window[lockLocalStorageKeyName];
        },

        lockPoll: async function () {
          const my = this;
          my._lockTimerCounter = my._lockPollingAttempts;
          await (async function Main() {
            while (my._lockTimerCounter) {
              await my.lockPollWait();
              if (!my.isLockSet()) {
                break;
              }
              my._lockTimerCounter--;
            }
          })();
        },

        lockPollWait: function () {
          const my = this;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, my._lockPollingTime);
          });
        }
      },

      _locLib: {
        idxNames: {
          tractor: [
            "Peripheral device: reefer temperature zone 4",
            "Peripheral device: reefer temperature zone 2",
            "Peripheral device: reefer temperature zone 3",
            "Peripheral device: reefer temperature zone 1",
            "Tire temperature: axle 4 tire 2",
            "Tire temperature: axle 4 tire 1",
            "Tire temperature: axle 2 tire 2",
            "Tire temperature: axle 5 tire 1",
            "Tire temperature: axle 8 tire 2",
            "Tire temperature: axle 14 tire 3",
            "Tire temperature: axle 15 tire 4",
            "Tire temperature: axle 8 tire 3",
            "Tire temperature: axle 10 tire 2",
            "Tire temperature: axle 5 tire 3",
            "Tire temperature: axle 10 tire 3",
            "Tire temperature: axle 5 tire 2",
            "Tire temperature: axle 13 tire 1",
            "Tire temperature: axle 7 tire 2",
            "Tire temperature: axle 7 tire 4",
            "Tire temperature: axle 11 tire 3",
            "Tire temperature: axle 14 tire 2",
            "Tire temperature: axle 6 tire 1",
            "Tire temperature: axle 9 tire 1",
            "Tire temperature: axle 9 tire 2",
            "Tire temperature: axle 9 tire 4",
            "Tire temperature: axle 3 tire 4",
            "Tire temperature: axle 5 tire 4",
            "Tire temperature: axle 10 tire 1",
            "Tire temperature: axle 7 tire 1",
            "Tire temperature: axle 3 tire 2",
            "Tire temperature: axle 11 tire 1",
            "Tire temperature: axle 12 tire 4",
            "Tire temperature: axle 15 tire 2",
            "Tire temperature: axle 4 tire 4",
            "Tire temperature: axle 2 tire 4",
            "Tire temperature: axle 13 tire 3",
            "Tire temperature: axle 8 tire 4",
            "Tire temperature: axle 11 tire 2",
            "Tire temperature: axle 6 tire 3",
            "Tire temperature: axle 13 tire 4",
            "Tire temperature: axle 1 tire 2",
            "Tire temperature: axle 3 tire 1",
            "Tire temperature: axle 9 tire 3",
            "Tire temperature: axle 12 tire 3",
            "Tire temperature: axle 13 tire 2",
            "Tire temperature: axle 1 tire 1",
            "Tire temperature: axle 1 tire 3",
            "Tire temperature: axle 6 tire 2",
            "Tire temperature: axle 12 tire 1",
            "Tire temperature: axle 3 tire 3",
            "Tire temperature: axle 12 tire 2",
            "Tire temperature: axle 11 tire 4",
            "Tire temperature: axle 8 tire 1",
            "Tire temperature: axle 2 tire 1",
            "Tire temperature: axle 7 tire 3",
            "Tire temperature: axle 6 tire 4",
            "Tire temperature: axle 15 tire 1",
            "Tire temperature: axle 14 tire 1",
            "Tire temperature: axle 2 tire 3",
            "Tire temperature: axle 15 tire 3",
            "Tire temperature: axle 4 tire 3",
            "Tire temperature: axle 14 tire 4",
            "Tire temperature: axle 1 tire 4",
            "Tire temperature: axle 10 tire 4",
            "Tire pressure: axle 15 tire 2",
            "Tire pressure: axle 5 tire 3",
            "Tire pressure: axle 1 tire 3",
            "Tire pressure: axle 13 tire 1",
            "Tire pressure: axle 14 tire 4",
            "Tire pressure: axle 1 tire 4",
            "Tire pressure: axle 10 tire 4",
            "Tire pressure: axle 6 tire 3",
            "Tire pressure: axle 2 tire 4",
            "Tire pressure: axle 11 tire 3",
            "Tire pressure: axle 5 tire 2",
            "Tire pressure: axle 9 tire 4",
            "Tire pressure: axle 13 tire 4",
            "Tire pressure: axle 7 tire 4",
            "Tire pressure: axle 13 tire 2",
            "Tire pressure: axle 15 tire 4",
            "Tire pressure: axle 4 tire 3",
            "Tire pressure: axle 3 tire 4",
            "Tire pressure: axle 3 tire 1",
            "Tire pressure: axle 12 tire 1",
            "Tire pressure: axle 7 tire 1",
            "Tire pressure: axle 2 tire 1",
            "Tire pressure: axle 6 tire 4",
            "Tire pressure: axle 1 tire 2",
            "Tire pressure: axle 5 tire 4",
            "Tire pressure: axle 3 tire 2",
            "Tire pressure: axle 12 tire 4",
            "Tire pressure: axle 10 tire 1",
            "Tire pressure: axle 8 tire 3",
            "Tire pressure: axle 8 tire 2",
            "Tire pressure: axle 11 tire 4",
            "Tire pressure: axle 12 tire 3",
            "Tire pressure: axle 6 tire 1",
            "Tire pressure: axle 11 tire 2",
            "Tire pressure: axle 6 tire 2",
            "Tire pressure: axle 2 tire 2",
            "Tire pressure: axle 5 tire 1",
            "Tire pressure: axle 15 tire 1",
            "Tire pressure: axle 15 tire 3",
            "Tire pressure: axle 12 tire 2",
            "Tire pressure: axle 9 tire 3",
            "Tire pressure: axle 10 tire 3",
            "Tire pressure: axle 9 tire 2",
            "Tire pressure: axle 4 tire 2",
            "Tire pressure: axle 14 tire 2",
            "Tire pressure: axle 9 tire 1",
            "Tire pressure: axle 11 tire 1",
            "Tire pressure: axle 4 tire 4",
            "Tire pressure: axle 7 tire 3",
            "Tire pressure: axle 8 tire 1",
            "Tire pressure: axle 3 tire 3",
            "Tire pressure: axle 13 tire 3",
            "Tire pressure: axle 2 tire 3",
            "Tire pressure: axle 4 tire 1",
            "Tire pressure: axle 10 tire 2",
            "Tire pressure: axle 7 tire 2",
            "Tire pressure: axle 14 tire 1",
            "Tire pressure: axle 14 tire 3",
            "Tire pressure: axle 8 tire 4",
            "Tire pressure: axle 1 tire 1",
            "Peripheral device: tractor ID",
            "Tractor tire location"
          ],

          trailer1: [
            "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
            "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
            "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
            "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
            "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
            "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
            "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
            "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
            "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
            "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
            "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
            "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
            "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
            "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
            "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
            "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
            "Peripheral device tire pressure: trailer 1 axle 4 tire 2",
            "Peripheral device: trailer 1 ID",
            "Trailer 1 tire location"
          ],

          trailer2: [
            "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
            "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
            "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
            "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
            "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
            "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
            "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
            "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
            "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
            "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
            "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
            "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
            "Peripheral device tire pressure: trailer 2 axle 6 tire 1",
            "Peripheral device: trailer 2 ID",
            "Trailer 2 tire location"
          ],

          trailer3: [
            "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
            "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
            "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
            "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
            "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
            "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
            "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
            "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
            "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
            "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
            "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
            "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
            "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
            "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
            "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
            "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
            "Peripheral device tire pressure: trailer 3 axle 3 tire 1",
            "Peripheral device: trailer 3 ID",
            "Trailer 3 tire location"
          ],
        },
        idxIds: {}
      },
    };
    return me;
  }.bind(this)();
};

/**********************************************************************************
 *  Manage / Generate cached Vehicle Sensor data for UI
 */
const INITSplSensorDataTools = function (goLib, cache) {

  /**
   *  Private Variables
   */
  this._sensorDataLifetime = 180;                 // (Default: 180 seconds) Afer this period, cached data is refreshed from API (in seconds)
  this._sensorSearchInProgressResponse = "BUSY";  // Do not allow simultaneous searches on the same vehicle

  this._goLib = null;
  this._cache = null;

  this._sensorDataNotFoundMsg = "";
  this._vehComponents = {};

  /**
   * Fetch vehicle sensor data from cache or API
   * ( cached is refreshed after X minutes, as defined in _sensorDataLifetime )
   *
   *  @return promise
   */
  this.fetchCachedSensorData = function (vehId, vehName) {
    const me = this;
    return new Promise((resolve, reject) => {
      if (typeof me._cache[vehId] === "undefined") {
        me._cache[vehId] = {
          searching: false,
          firstTime: true,
          noSensorDataFound: false,
          expiry: moment().utc().add(me._sensorDataLifetime, "seconds").unix(),
          data: null
        };
      }
      // Do not allow simultaneous searches on the same vehicle
      if (me._cache[vehId].searching) {
        reject(me._sensorSearchInProgressResponse);
      }
      else if (me._cache[vehId].data === null || me._cache[vehId].expiry < moment().utc().unix()) {
        me._cache[vehId].searching = true;
        me._cache[vehId].noSensorDataFound = true;

        // On first-time search of a vehicle
        // In Geotab library, reset the Sensor Search Parameters to a new Vehicle configuration
        if (me._cache[vehId].data === null) {
          me._goLib.resetAsFirstTime();
        }

        // DEBUG TEMP
        let debugCacheData = "";
        let debugSensorData = "";

        //Splunk for sensor data
        me._fetchData(vehId)
          .then((sensorData) => {
            me._cache[vehId].searching = false;

            // Save Vehicle Name
            sensorData.vehName = vehName;

            // Report on what we found on the initial search only,
            // Reporting on Repeat searches will be handled by the data merging code
            if (me._cache[vehId].data === null) {
              me._cache[vehId].noSensorDataFound = false;

              if (sensorData.vehCfg.total === 1) {
                console.log("--- NEW SENSOR DATA FOUND after the last search.  " +
                  "Temptrac [" + Object.keys(sensorData.temptrac).length + "]  " +
                  "TPMS Temperature [" + Object.keys(sensorData.tpmstemp).length + "]  " +
                  "TPMS Pressure [" + Object.keys(sensorData.tpmspress).length + "]"
                );
              }
              else {
                sensorData.vehCfg.ids.map(compId => {
                  console.log("--- NEW SENSOR DATA FOUND on " +
                    me._vehComponents[compId].toUpperCase() + " after the last search.  " +
                    "Temptrac [" + Object.keys(sensorData[compId].temptrac).length + "]  " +
                    "TPMS Temperature [" + Object.keys(sensorData[compId].tpmstemp).length + "]  " +
                    "TPMS Pressure [" + Object.keys(sensorData[compId].tpmspress).length + "]"
                  );
                });
              }
            }

            // If cache is EMPTY, populate with new sensor data
            if (me._cache[vehId].data === null) {
              if (sensorData.vehCfg.total === 1) {
                sensorData[sensorData.vehCfg.active] = {
                  temptrac: sensorData.temptrac,
                  tpmspress: sensorData.tpmspress,
                  tpmstemp: sensorData.tpmstemp
                };
                delete sensorData.temptrac;
                delete sensorData.tpmspress;
                delete sensorData.tpmstemp;
              }
              me._cache[vehId].data = sensorData;
            }
            // Merge NEW Single-Component (possibly TRACTOR) data with cached data
            else if (sensorData.vehCfg.total === 1) {

              // Flag all data in cache as OLD
              me._resetSensorDataInCache(vehId);

              // Merge with Single-Component cached data
              if (me._cache[vehId].data.vehCfg.total === 1) {
                debugCacheData = JSON.stringify(me._cache[vehId].data[me._cache[vehId].data.vehCfg.active]); //DEBUG
                debugSensorData = JSON.stringify(sensorData); //DEBUG
                me._cache[vehId].data[me._cache[vehId].data.vehCfg.active] =
                  me._mergeSensorDataIntoCache(
                    me._cache[vehId].data[me._cache[vehId].data.vehCfg.active],
                    sensorData,
                    me._cache[vehId].data.vehCfg.active,
                    vehId
                  );
              }
              // Merge with Multi-Component cached data
              else {
                me._cache[vehId].data.vehCfg.ids.map(cacheCompId => {
                  if (cacheCompId === sensorData.vehCfg.active) {
                    debugCacheData = JSON.stringify(me._cache[vehId].data[cacheCompId]); //DEBUG
                    debugSensorData = JSON.stringify(sensorData); //DEBUG
                    me._cache[vehId].data[cacheCompId] = me._mergeSensorDataIntoCache(
                      me._cache[vehId].data[cacheCompId],
                      sensorData,
                      cacheCompId,
                      vehId
                    );
                  }
                });
              }
            }
            // Merge NEW Multi-Component Vehicle data with cached data
            else {

              // Flag all data in cache as OLD
              me._resetSensorDataInCache(vehId);

              // Merge with Single-Component cached data
              if (me._cache[vehId].data.vehCfg.total === 1) {
                sensorData.vehCfg.ids.map(compId => {
                  if (compId === me._cache[vehId].data.vehCfg.active) {
                    console.log("----------------- compId = ", compId, " cache = ", me._cache[vehId].data[compId], " sdata = ", sensorData[compId]);
                    debugCacheData = JSON.stringify(me._cache[vehId].data[compId]); //DEBUG
                    debugSensorData = JSON.stringify(sensorData[compId]); //DEBUG
                    sensorData[compId] = me._mergeSensorDataIntoCache(
                      me._cache[vehId].data[compId],
                      sensorData[compId],
                      compId,
                      vehId
                    );
                  }
                });
                me._cache[vehId].data = sensorData;
              }
              // Merge with Multi-Component cached data
              else {
                sensorData.vehCfg.ids.map(compId => {
                  debugCacheData = JSON.stringify(me._cache[vehId].data[compId]); //DEBUG
                  debugSensorData = JSON.stringify(sensorData[compId]); //DEBUG
                  me._cache[vehId].data[compId] = me._mergeSensorDataIntoCache(
                    me._cache[vehId].data[compId],
                    sensorData[compId],
                    compId,
                    vehId
                  );
                });
              }
            }

            // Notify if no sensor data was found
            if (me._cache[vehId].noSensorDataFound) {
              console.log("NO NEW SENSOR DATA FOUND for this date range");
            }

            // Set next cache expiry
            me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();

            // Fresh data, update cache and then send it
            resolve(me._cache[vehId].data);
          })
          .catch((reason) => {
            me._cache[vehId].searching = false;

            if (me._cache[vehId].data === null) {
              // If there was never any sensor data for this vehicle, notify User
              console.log("---- ERROR OCCURED WHILE PROCESSING DATA for Vehicle [ " + vehName + " ]:", reason);
              reject(reason);
            }
            else {
              if (reason === me._sensorDataNotFoundMsg) {
                console.log("NO NEW SENSOR DATA FOUND for this date range.");
              }
              else {
                console.log("---- ERROR OCCURED WHILE PROCESSING DATA: " + reason);
                console.log("---- mergeSensorDataIntoCache(): cache = ", debugCacheData, " sdata = ", debugSensorData);
              }
            }

            // Resetting when we will search again for new data
            me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();

            // Nothing new with this data, so don't send anything to UI
            resolve({});
          });
      }
      else {
        // Nothing new with this data, so don't send anything to UI
        resolve({});
      }
    });
  };

  /**
   * Standardized error response used when Library busy with search in progress
   *
   *  @return string
   */
  this.getSensorSearchInProgressResponse = function () {
    const me = this;
    return me._sensorSearchInProgressResponse;
  };

  /**
   * Getters/Setters for _sensorDataLifetime
   * ( Minimum Value - 10 seconds )
   */
  this.getSensorDataLifetimeInSec = function () {
    const me = this;
    return me._sensorDataLifetime;
  };
  this.setSensorDataLifetimeInSec = function (seconds) {
    const me = this;
    if (seconds >= 10) {
      me._sensorDataLifetime = seconds;
    }
  };

  /**
   * Getters/Setters for firstTime
   */
  this.getFirstTime = function (vehId) {
    const me = this;
    return typeof me._cache[vehId].firstTime === "undefined" ? true : me._cache[vehId].firstTime;
  };
  this.setFirstTime = function (vehId, firstTime) {
    const me = this;
    if (typeof me._cache[vehId].firstTime !== "undefined") {
      me._cache[vehId].firstTime = firstTime;
    }
  };

  /**
   * Getters/Setters for _vehComponents
   */
  this.getVehComponents = function () {
    const me = this;
    return me._vehComponents;
  };
  this.setVehComponents = function (comLib) {
    const me = this;
    me._vehComponents = comLib;
  };

  /**
   * Getters/Setters for _sensorDataNotFoundMsg
   */
  this.getSensorDataNotFoundMsg = function () {
    const me = this;
    return me._sensorDataNotFoundMsg;
  };
  this.setSensorDataNotFoundMsg = function (msg) {
    const me = this;
    me._sensorDataNotFoundMsg = msg;
  };

  /**
   * Getters/Setters for _sensorSearchInProgressResponse
   */
  this.getSensorSearchInProgressResponseMsg = function () {
    const me = this;
    return me._sensorSearchInProgressResponse;
  };
  this.setSensorSearchInProgressResponseMsg = function (msg) {
    const me = this;
    me._sensorSearchInProgressResponse = msg;
  };

  /**
   * Clear the Sensor data cache of all vehicles
   * IF a SEARCH OPERATION is NOT occuring
   *
   *  @return boolean
   */
  this.resetCache = function () {
    const me = this;
    for (const vehId in me._cache) {
      if (me._cache[vehId].searching) {
        return false;
      }
    }
    me._cache = {};
    return true;
  };

  /**
   *  Fetch Temptrac and TPMS sensor data
   *
   *  @return promise
   */
  this._fetchData = function (vehId) {
    const me = this;
    return new Promise((resolve, reject) => {
      me._goLib.getData(vehId, "", function (sensorData) {
        if (sensorData === null) {
          reject(me._sensorDataNotFoundMsg);
        }
        else {
          // Single-Vehicle Component found (normally TRACTOR, but we should not assume)
          if (sensorData.vehCfg.total === 1) {
            resolve(sensorData);
          }
          // Multi-Vehicle Component(s) found (any combination of "tractor", "trailer1", "trailer2", "trailer3")
          else {
            const vehCompFound = sensorData.vehCfg.active;
            let ids = sensorData.vehCfg.ids.filter((id) => { return id !== vehCompFound; });
            const data = {
              vehCfg: sensorData.vehCfg,
              vehId: sensorData.vehId,
            };
            data[vehCompFound] = {
              temptrac: sensorData.temptrac,
              tpmspress: sensorData.tpmspress,
              tpmstemp: sensorData.tpmstemp,
            };
            sensorData.vehCfg.ids
              .filter(compId => { return (compId !== vehCompFound); })
              .map(compId => {
                fetchVehSensorDataAsync(vehId, compId, me._cache[vehId].firstTime)
                  .then((sdata) => {
                    data[compId] = {
                      temptrac: sdata.temptrac,
                      tpmspress: sdata.tpmspress,
                      tpmstemp: sdata.tpmstemp,
                    };
                    ids = ids.filter((id) => { return id !== compId; });
                  })
                  .catch(() => {
                    data[compId] = null;
                  })
                  .finally(() => {
                    if (ids.length === 0) {
                      resolve(data);
                    }
                  });
              });
          }
        }
      }, typeof me._cache[vehId].firstTime !== "undefined" ? me._cache[vehId].firstTime : null);
    });
  };

  /**
   * Reset cached data as old, prior to merging with new data
   * by reseting all location records as originating from cache and therefore NOT new
   *
   * @param {string} vehId       - Geotab Device Id
   * @param {boolean} clearNulls - Reset stale NEW sensor readings to OLD readings
   *
   * @return object
   */
  this._resetSensorDataInCache = function (vehId, clearNewNulls) {
    const me = this;
    const resetNewNulls = typeof clearNewNulls !== "undefined" && clearNewNulls === true ? true : false;
    me._cache[vehId].data.vehCfg.ids.map(compId => {
      ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
        if (typeof me._cache[vehId].data[compId] !== "undefined" &&
          me._cache[vehId].data[compId].hasOwnProperty(type) &&
          Object.keys(me._cache[vehId].data[compId][type]).length) {
          Object.keys(me._cache[vehId].data[compId][type]).forEach(function (loc) {
            if (resetNewNulls) {
              if (typeof me._cache[vehId].data[compId][type][loc].new !== "undefined" &&
                me._cache[vehId].data[compId][type][loc].new === null) {
                me._cache[vehId].data[compId][type][loc].new = false;
              }
            }
            else {
              if (typeof me._cache[vehId].data[compId][type][loc].new === "undefined") {
                me._cache[vehId].data[compId][type][loc].new = false;
              }
              else {
                if (me._cache[vehId].data[compId][type][loc].new === true) {
                  me._cache[vehId].data[compId][type][loc].new = null;
                }
              }
            }
          });
        }
      });
    });
  };

  /**
   * Merge fresh sensor data with existing cache data (by sensor location)
   *
   *  @return object
   */
  this._mergeSensorDataIntoCache = function (cache, sdata, vehCompId, vehId) {
    if (cache === null) {
      return sdata;
    }
    const me = this;
    let newSensorDataFound = false;

    // Merge new data into Cache
    ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
      let mergeCount = 0;

      if (sdata.hasOwnProperty(type) && Object.keys(sdata[type]).length) {
        Object.keys(sdata[type]).forEach(function (loc) {
          if (typeof cache[type][loc] !== "undefined") {
            const cacheTime = cache[type][loc].time;
            const sdataTime = sdata[type][loc].time;
            if (cacheTime !== sdataTime) {
              mergeCount++;
              cache[type][loc] = sdata[type][loc];
              cache[type][loc].new = true;
              newSensorDataFound = true;
            }
          }
          // AxleTire in sdata does not exist in cache...Insert it
          else {
            mergeCount++;
            cache[type][loc] = sdata[type][loc];
            cache[type][loc].new = true;
            newSensorDataFound = true;
          }
        });
        if (mergeCount) {
          const vehCompDesc =
            typeof vehCompId !== "undefined" && vehCompId ?
              me._vehComponents[vehCompId].toUpperCase() :
              "";

          console.log("--- Found and Merged [ " + mergeCount + " ] " +
            (type === "temptrac" ? "Temptrac" :
              (type === "tpmstemp" ? "TPMS Temperature" :
                "TPMS Pressure")) +
            " sensor data records" +
            (vehCompDesc ? " from " + vehCompDesc : "")
          );
        }
      }
    });
    if (newSensorDataFound) {
      me._cache[vehId].noSensorDataFound = false;
      me._resetSensorDataInCache(vehId, true);
    }
    return cache;
  };

  /**
   *  INIT - Constructor, When an instance gets created
   *
   *  @return void
   */
  this._configure = function (goLib, cache) {
    if (goLib && typeof goLib === "object") {
      this._goLib = goLib;
    }
    if (typeof cache !== "undefined" && cache && typeof goLib === "object") {
      this._cache = cache;
    }
    else {
      this._cache = {};
    }
  };

  this._configure(goLib, cache);
};

