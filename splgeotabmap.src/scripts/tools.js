/* eslint-disable no-unused-vars */

/**********************************************************************************
 * Register these Add-In Event Handlers with Geotab Map API on APP Load
 */
const onLoadInitEvents = function (my) {

  // Event: User moves mouse over Vehicle on the map
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
          }
          //
          else {
            console.log(`--- VehId [ ${evt.entity.id} ] Location could not be found!`);
          }
        });
    }
  });

  // Event: User moves mouse out of a Vehicle on the map
  my.service.events.attach("out", (evt) => {
    // Remove this Vehicle from ToolTip registry to disable update attempt by the uiUpdateService
    if (evt.type === "device" && my.storage.sensorData.vehRegistry.tooltip === evt.entity.id) {
      my.storage.sensorData.vehRegistry.tooltip = "";
    }
  });

  // Event: User focuses on SplMap Deeper add-in (Show What I Know)
  my.service.page.attach("focus", () => {
    console.log("--- Focus Occured"); //DEBUG
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
    console.log("--- Blur Occured"); //DEBUG
    // Cancel all Pending Tasks in App
    my.app.cancelPendingTasks();
  });

  // Event: The state of the page has changed
  my.service.page.attach("stateChange", (evt) => {
    console.log("--- StateChange Occured", JSON.stringify(evt)); //DEBUG
  });

  // Event: Reset Button clicked
  my.resetBtnElemObj.addEventListener("click", () => {
    my.app.resetApp();
  });
};

/**********************************************************************************
 * Register these Add-In Event Handlers with Geotab Map API after TR initialization
 */
const loadInitEventsPostTr = function (my) {

  // Register Vehicle Menu-Item on map
  my.service.actionList.attachMenu("vehicleMenu", (_, rest) => {
    return Promise.resolve([
      {
        title: my.tr("map_menuitm_label"),
        clickEvent: "ShowSplDeviceInfo",
        data: rest.device,
      },
    ]);
  });

  // Event: Clicked Vehicle Menu-Item on map
  my.service.actionList.attach("ShowSplDeviceInfo", ({ id }) => {
    Promise.all([
      my.service.api.call("Get", {
        typeName: "Device",
        search: { id },
      }),
      my.service.api.call("Get", {
        typeName: "DeviceStatusInfo",
        search: { deviceSearch: { id } },
      }),
    ]).then(([[device], [dsi]]) => {
      my.ui.showMenuItem(id, device.name, dsi.speed);
    });
  });
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
        const encryptedStorageCfgObj = JSON.parse(sjcl.encrypt(me._storageSecret, JSON.stringify(dataBak)));
        const unencryptedSensorDataObj = JSON.parse(JSON.stringify(my.storage.sensorData));

        my.service.localStorage.set(storageCfgKey, encryptedStorageCfgObj).then(() => {
          my.service.localStorage.set(storageCacheKey, unencryptedSensorDataObj).then(() => {
            console.log("--- Successfully Saved data to Local Storage");
            if (me._callback) {
              me._callback(); // Invoke callback if provided
              me._callback = null;
            }
          });
        });
        me._setTimerHandle = null;
      }, saveWaitTime);
    }
  };

  /**
   *  Get encrypted storage data from localStorage, then decrypt the encryted parts and restore the whole
   *  @returns {*} An object with a property as JS object
   */
  this.load = function (callback) {
    const me = this;
    const my = me._my;
    const storageCfgKey = me._storageKey + "_CFG";
    const storageCacheKey = me._storageKey + "_CACHE";
    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    Promise.all([
      my.service.localStorage.get(storageCfgKey),
      my.service.localStorage.get(storageCacheKey),
    ]).then(([encryptedStorageCfgObj, unencryptedSensorDataObj]) => {
      // Storage data is paired, so both must exist
      if (encryptedStorageCfgObj !== null && unencryptedSensorDataObj !== null) {
        // Decrypt & Save
        my.storage = JSON.parse(sjcl.decrypt(me._storageSecret, JSON.stringify(encryptedStorageCfgObj)));
        my.storage.sensorData = unencryptedSensorDataObj;

        // Set Sensor Data Cache
        my.sdataTools._cache = my.storage.sensorData.cache;
        console.log("--- Successfully restored data from Local Storage: ");
      }
      // Delete one if the other is missing
      else {
        if (encryptedStorageCfgObj !== null) {
          my.service.localStorage.remove(storageCfgKey);
        }
        if (unencryptedSensorDataObj !== null) {
          my.service.localStorage.remove(storageCacheKey);
        }
        console.log("--- Local Storage Empty");
      }
      if (me._callback) {
        me._callback(my.storage); // Invoke callback if provided
        me._callback = null;
      }
    });
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

    my.service.localStorage.remove(storageCfgKey).then(() => {
      my.service.localStorage.remove(storageCacheKey).then(() => {
        console.log("--- Successful purged data from Local Storage");
        if (me._callback) {
          me._callback(); // Invoke callback if provided
          me._callback = null;
        }
      });
    });
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

        // Complete App API Event Registration(s)
        loadInitEventsPostTr(my);

        // Reset sensor data search for all vehicles
        me.resetSearch();

        // Apply run-time settings to sensor data search library
        my.sdataTools.setSensorDataLifetimeInSec(my.storage.splStore.sensorInfoRefreshRate); // "sensorInfoRefreshRate" from SplTools
        my.sdataTools.setSensorDataNotFoundMsg(my.tr("sensors_not_found"));

        // Init About Info in Logo / Watermark
        my.logo.init();

        // Restore Vehicle Sensor Data Panel
        const vehId = my.storage.sensorData.vehRegistry.menuItem;
        if (vehId && typeof my.storage.sensorData.cache[vehId] !== "undefined") {
          const vehName = my.storage.sensorData.cache[vehId].data.vehName;
          my.service.api.call("Get", {
            typeName: "DeviceStatusInfo",
            search: { deviceSearch: { id: vehId } }
          }).then(([dsi]) => {
            const vehSpeed = dsi.speed;
            my.ui.renderMenuItemHTML(vehId, vehName, vehSpeed, me.getCachedSensorDataStatusForVeh(vehId, vehName));
            my.ui.updateService.start();
          });
        }
        // Otherwise, set initial UI message
        else {
          my.ui.showMsg(my.tr("panel_user_instruction"));
        }

        // Invoke callback if provided
        if (me._callback) {
          me._callback();
          me._callback = null;
        }
      },

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
          // 3. non-MyGeotab (containes SplMap/SplTools URL pageName reference to proxy instance(s) running on help.spartansense.com)
          //
          if (!my.storage.credentials.sessionId ||
            !my.storage.splStore ||
            cachedStoreExpiry < now ||
            (typeof my.storage.splStore.splMap.mapsPageName !== "undefined" &&
              my.storage.splStore.splMap.mapsPageName.indexOf("help.spartansense.com") > -1) ||
            (typeof my.storage.splStore.splMap.toolsPageName !== "undefined" &&
              my.storage.splStore.splMap.toolsPageName.indexOf("help.spartansense.com") > -1)) {
            me.getSplSettings()
              .then(() => {
                me.startup();
              })
              .catch((reason) => my.ui.showError(reason));
          }
          else {
            me.startup();
          }

          // Init App Handler(s)
          window.navigateToSplTools = me.navigateToSplTools.bind(this); // Page-Navigation Handler
          window.fetchVehSensorDataAsync = me.fetchVehSensorDataAsync.bind(this); // Async Sensor Data Fetch Handler
        });
      },

      /**
       * getSplSettings() Fetch and store SpartanLync Store data for current logged-in Geotab Account
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
                (remoteStore) => {
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
                  resolve(); // Notify on successful Load
                },
                (reason) => reject(my.tr("error_startup_general") + " " + reason)
              );
            })
            .catch((reason) => reject(my.tr("error_startup_general") + " " + reason));
        });
      },

      /**
       *  Perform page-redirect navigation to SpartanLync Tools Add-in
       *
       *  @returns void
       */
      navigateToSplTools: (vehId, vehName) => {
        const splToolsPageName = my.storage.splStore.splMap.toolsPageName;
        console.log("----- Navigating to SpartanLync Tools Add-in [ " + splToolsPageName + " ] to view Vehicle [ " + vehName + " ]");
        my.service.page
          .hasAccessToPage(splToolsPageName)
          .then((accessGranted) => {
            if (accessGranted) {
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
       * getSensorData() Invoke the retrieval process for sensor data in cache
       *
       * @return void
       */
      getSensorData: function (vehId, vehName) {
        if (my.storage.sensorData.searchInProgress) {
          console.log(`=== getSensorData() ======================= ASYNC FETCH FOR Vehicle [ ${vehId} ], as SEARCH IN PROGRESS ON Vehicle [ ${my.storage.sensorData.searchInProgress} ]`); //DEBUG
          const aSyncGoLib = INITGeotabTpmsTemptracLib(
            my.service.api,
            my.sensorSearchRetryRangeInDays,
            my.sensorSearchTimeRangeForRepeatSearchesInSeconds,
          );
          const aSyncSdataTools = new INITSplSensorDataTools(aSyncGoLib, my.storage.sensorData.cache);
          aSyncSdataTools.setSensorDataLifetimeInSec(my.storage.splStore.sensorInfoRefreshRate);
          aSyncSdataTools.setSensorDataNotFoundMsg(my.tr("sensors_not_found"));
          aSyncSdataTools.setVehComponents(my.vehComponents.toEn);
          aSyncSdataTools.fetchCachedSensorData(vehId, vehName)
            .then(() => me.postGetSensorData(vehId, vehName))
            .catch((reason) => console.log(`--- getSensorData(ASYNC) Error fetching sensor data for [ ${vehName} / ${vehId} ]: `, reason))
            .finally(() => {
              my.storage.sensorData.searchInProgress = "";
            });
        }
        else {
          console.log(`=== getSensorData() ======================= FETCHING VEH [ ${vehName} / ${vehId} ]`); //DEBUG
          my.storage.sensorData.searchInProgress = vehId;
          my.sdataTools.fetchCachedSensorData(vehId, vehName)
            .then(() => me.postGetSensorData(vehId, vehName))
            .catch((reason) => console.log(`--- getSensorData() Error fetching sensor data for [ ${vehName} / ${vehId} ]: `, reason))
            .finally(() => {
              my.storage.sensorData.searchInProgress = "";
            });
        }
      },

      /**
       * postGetSensorData() Operations perfromed after fetching sensor data into cache
       *
       * @return void
       */
      postGetSensorData: function (vehId, vehName) {
        console.log(`=== postGetSensorData() ======================= SUCCESS [ ${vehName} / ${vehId} ]`); //DEBUG
        // Reset search status and Backup found sensor data
        my.storage.sensorData.searchInProgress = "";

        // Perform SAVE operation, to backup sensor search changes
        my.localStore.save();
      },

      /**
       * fetchSensorTypes() Analyse sensor data looking for Temptrac/TPMS Sensor Types
       *
       * @return Array() of types "Temptrac" / "TPMS"
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
      *  fetchVehSensorDataAsync() Asynchronously fetch Temptrac/TPMS sensor data
      *
      *  @returns object / string (on Error)
      */
      fetchVehSensorDataAsync: function (vehId, vehComp, firstTimeCallOverride) {
        const vehComponent = vehComp || "";
        const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
        return new Promise((resolve, reject) => {
          const aSyncGoLib = INITGeotabTpmsTemptracLib(
            my.service.api,
            my.sensorSearchRetryRangeInDays,
            my.sensorSearchTimeRangeForRepeatSearchesInSeconds
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
            my.storage.splStore = null;
            my.sdataTools.resetCache();
            my.storage.sensorData.cache = {};
            my.storage.sensorData.vehRegistry.menuItem = "";
            me.init(() => {
              my.ui.showMsg(my.tr("reset_btn_msg") + "<p>" + my.tr("panel_user_instruction"));
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
        // Stop UI Update Polling Service / Task
        my.ui.updateService.stop();
      },

      /**
       * Convert from Unix timestamp to Human-readable time
       * eg. Sa Aug 17, 2020 7:00 PM EDT
       *
       *  @returns string
       */
      convertUnixToTzHuman: function (unixTime) {
        const me = this;
        return isNaN(unixTime) ? null : moment.unix(unixTime).format(my.timeFormat);
      },

      /**
       * Language Translation Tools
       *
       *  @returns void
       */
      tr: function () {
        const me = {
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
            return trVal;
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
   *  @returns string
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
        if (me._isSuccess(result)) {
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
   *  Handler for Setting debug in SplAPI
   */
  this.enableDebug = function (enable) {
    const me = this;
    me._api.enableDebug(enable);
  };

  this._isSuccess = function (result) {
    if (
      typeof result !== "undefined" &&
      result !== null &&
      typeof result === "object" &&
      typeof result.responseStatus !== "undefined" &&
      result.responseStatus !== null &&
      typeof result.responseStatus &&
      result.responseStatus === "success" &&
      typeof result.data !== "undefined" &&
      result.data !== null &&
      result.data
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
   *  @returns string
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
 *  StartanLync library for searching Geotab for TempTrac / TPMS sensor data
 */
/* eslint-disable complexity */
/* eslint-disable camelcase */
const INITGeotabTpmsTemptracLib = function (api, retrySearchRange, repeatingSearchRange) {
  return function () {
    const me = {
      /**
       *  Private Variables
       */
      _timer: {},

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
          trailer3: "Trailer 2",
        },
      },

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
       * getVehStatus() Retrieves Vehicle status info from Geotab API
       *
       * @param {string} devId    - Geotab Device Id
       * @param {string} callback - Callback func to invoke upon retrieval of data
       *
       * @return {array} Vehicle status object
       */

      getVehStatus: function (devId, vStatusCallback) {
        if (devId.toString().trim() === "" || typeof vStatusCallback === "undefined" || typeof vStatusCallback !== "function") {
          return;
        }

        // Build DeviceStatus API Call
        const apiCall = {
          typeName: "DeviceStatusInfo",
          search: {
            deviceSearch: {
              id: devId,
            },
          },
        };
        console.log("--- getVehStatus(): Collecting latest Vehicle Status information...");

        // Invoke Device Status API Call
        me._timer.a1 = new Date();
        me._api
          .call("Get", apiCall)
          .then(function (result) {
            if (result && result.length) {
              const vehStatusObj = result[0];
              me._timer.a2 = new Date();
              console.log("--- getVehStatus(): Vehicle Status Info retrieved - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
              vStatusCallback(vehStatusObj);
            } else {
              console.log("--- Error: getVehStatus.api.call(): EMPTY RESPONSE");
              vStatusCallback(null);
            }
          })
          .catch((errorString) => {
            me._timer.a2 = new Date();
            console.log("--- Vehicle Status Info retrieval failed - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
            console.log("--- Error: getVehStatus.api.call(): " + errorString);
            vStatusCallback(null);
          });
      },

      getVehComponentDB: function () {
        return me._devComponents;
      },

      resetAsFirstTime: function () {
        me._devId = null;
        me._devConfig = {};
        me._devSelectedComp = "";
        me._apiCallFaultRetryCount = 0;
        me._apiCallRetryCount = 0;
        me._apiFirstTimeCall = true;
        me._apiFaultFirstTimeCall = true;
      },

      resetForNewVehComponent: function () {
        me._devId = null;
        me._devSelectedComp = "";
        me._apiCallFaultRetryCount = 0;
        me._apiCallRetryCount = 0;
        me._apiFirstTimeCall = true;
        me._apiFaultFirstTimeCall = true;
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
        me._api
          .multiCall(me._buildApiCall(vehComps))
          .then(function (result) {
            if (result && result.length) {
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
                    // Invalid records discarded
                    if (
                      !srec.id ||
                      !srec.dateTime ||
                      srec.device.id !== me._devId ||
                      typeof srec.diagnostic.id === "undefined" ||
                      !(moment(srec.dateTime).unix() > moment(me._fromDate).unix() && moment(srec.dateTime).unix() < moment(me._toDate).unix())
                    ) {
                      continue;
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
                        time: moment(srec.dateTime).unix(),
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
                        time: moment(srec.dateTime).unix(),
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
                        time: moment(srec.dateTime).unix(),
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

      _extractZoneFromLoc: function (loc) {
        return loc.split("reefer temperature")[1].trim().replace("zone", "Zone");
      },

      _extractAxleFromLoc: function (loc) {
        return loc.split(":")[1].trim().replace("axle", "Axle").replace("tire", "Tire");
      },

      _buildApiCall: function (vehCmps) {
        const calls = [];
        const vehComps = vehCmps || me._devComponents.ids.split(",")[0]; // If undefined, only get tractor sensors

        for (const comp of vehComps.split(",")) {
          for (const loc of me._locLib.idxNames[comp]) {
            const diagId = me._locLib[loc].id;
            calls.push([
              "Get",
              {
                typeName: "StatusData",
                search: {
                  fromDate: me._fromDate,
                  toDate: me._toDate,
                  deviceSearch: {
                    id: me._devId,
                  },
                  diagnosticSearch: {
                    id: diagId,
                  },
                },
              },
            ]);
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
          ],
        },
        idxIds: {
          /* TempTrac */
          DiagnosticReeferTemperatureZone4Id: "Peripheral device: reefer temperature zone 4",
          DiagnosticReeferTemperatureZone2Id: "Peripheral device: reefer temperature zone 2",
          DiagnosticReeferTemperatureZone3Id: "Peripheral device: reefer temperature zone 3",
          DiagnosticReeferTemperatureZone1Id: "Peripheral device: reefer temperature zone 1",

          /* Tractor */
          "af-aART3R20iqTABMMuOQug": "Tire temperature: axle 4 tire 2",
          aJ5BZCAIRcUOtSQU2ah125Q: "Tire temperature: axle 4 tire 1",
          aJ6V9PwpaWEK6YwvKSLxuDg: "Tire temperature: axle 2 tire 2",
          afTvCGj0LME2nPQ_yi6Zprg: "Tire temperature: axle 5 tire 1",
          "awgE9H0owikaNhxQp-8ORrg": "Tire temperature: axle 8 tire 2",
          a_QqQSc7prEmssBy2cr4GiQ: "Tire temperature: axle 14 tire 3",
          "acHLkVisytUqE-SFYpyke-Q": "Tire temperature: axle 15 tire 4",
          aksQyj4DQBky5HyURZiKYwg: "Tire temperature: axle 8 tire 3",
          aSLXud_CMGEiskiVrUGfDZw: "Tire temperature: axle 10 tire 2",
          a1hqxUSZzJ0S2JyYEyo_VeQ: "Tire temperature: axle 5 tire 3",
          abmqqxx7dREm4XCdaJagnKw: "Tire temperature: axle 10 tire 3",
          "a1-Xqquf_Pk2BLTSnpF2OLw": "Tire temperature: axle 5 tire 2",
          "anVIOrFs7-UC7rjVos2KK0w": "Tire temperature: axle 13 tire 1",
          aR1xLRYgjQ0ilhjk5Af9ijQ: "Tire temperature: axle 7 tire 2",
          aCIDQe8BU90KbPzprepe2pA: "Tire temperature: axle 7 tire 4",
          "aj0WbeSf22U-D90H53AUPGw": "Tire temperature: axle 11 tire 3",
          "aMcfoAqAI_0qftES-nOkdXg": "Tire temperature: axle 14 tire 2",
          a2DB7ykkjnEmPsEUM8ax4Qw: "Tire temperature: axle 6 tire 1",
          "a7hDn0EY6kk-LJUhgheNKgw": "Tire temperature: axle 9 tire 1",
          a_x2ggICa9EaLmUmijtxVxw: "Tire temperature: axle 9 tire 2",
          aySNM1EiJRUW5c0m_2MNk_Q: "Tire temperature: axle 9 tire 4",
          a5zQnIKLK1EGJc0y74FM76Q: "Tire temperature: axle 3 tire 4",
          "auMikJD79gk-SaVPlRyg0Cg": "Tire temperature: axle 5 tire 4",
          aKe_wiJuqJE2jNV0ihv4eeA: "Tire temperature: axle 10 tire 1",
          azHJzyul44Um0gmMP5OKW8g: "Tire temperature: axle 7 tire 1",
          a3_U0ud3wbkKNvGRSVJATOg: "Tire temperature: axle 3 tire 2",
          "adq1VIj3Mbk-ZKmYOnn5Djw": "Tire temperature: axle 11 tire 1",
          "atHQLX-xXBEalP2aOLb2cNA": "Tire temperature: axle 12 tire 4",
          a_IYsTjcEMEm762d24DFUdA: "Tire temperature: axle 15 tire 2",
          afGmJoFp5M02mSmv6iumwfQ: "Tire temperature: axle 4 tire 4",
          alXGwTauFBkq48G840Hni1g: "Tire temperature: axle 2 tire 4",
          "aoMlYiDcBlk-cPnLliFLTtw": "Tire temperature: axle 13 tire 3",
          ajMeii2CJykmBHHNtskGPyQ: "Tire temperature: axle 8 tire 4",
          afbN7sX31KEqhoHTZAIKFnw: "Tire temperature: axle 11 tire 2",
          "apPupKJzE6Um-PHd2-XGVbQ": "Tire temperature: axle 6 tire 3",
          arrO0vmDWZEOIFnfLvRMxkQ: "Tire temperature: axle 13 tire 4",
          a1ZcS5E35KkOVBXxcqSCihQ: "Tire temperature: axle 1 tire 2",
          a2Sj4el_ot0akRIAFB3j3dA: "Tire temperature: axle 3 tire 1",
          amhgewWRlz0e8M4VA1o1tkQ: "Tire temperature: axle 9 tire 3",
          "aV00Fh2yuRk2a-pCjfLbOAQ": "Tire temperature: axle 12 tire 3",
          aGv5W2jGib0qGmZFTthHqxg: "Tire temperature: axle 13 tire 2",
          aMc7Tbwr7oEG_65ZlQIhe8A: "Tire temperature: axle 1 tire 1",
          "ayIh-pPu-BUyW35gJQDE-eQ": "Tire temperature: axle 1 tire 3",
          alIBMrLvBRkGoJZwLXT4aNA: "Tire temperature: axle 6 tire 2",
          "a-Z4vcpJrK0OcAZ4JV5-DUA": "Tire temperature: axle 12 tire 1",
          ahQIxeVmRhUWwja1X5JWRmw: "Tire temperature: axle 3 tire 3",
          aPtrBlvZnR0GGJbSgpf7YtA: "Tire temperature: axle 12 tire 2",
          aSEhZa5CWvEWFPLorvUtl9A: "Tire temperature: axle 11 tire 4",
          aVyx_amL1G067I7yelZtTqg: "Tire temperature: axle 8 tire 1",
          aB1AI1v7VZEuEpL9DL2pX5w: "Tire temperature: axle 2 tire 1",
          "aJcg4DnM3AUaZQc-dTwheRA": "Tire temperature: axle 7 tire 3",
          aRQu7NYg_rUykKdD5aLB3Tg: "Tire temperature: axle 6 tire 4",
          avTVfxhYRP0K5Fdf2UnmVFw: "Tire temperature: axle 15 tire 1",
          aN8DkqeyfYkGUZdmBUqL7WA: "Tire temperature: axle 14 tire 1",
          ajfPPsCzHZkOMSeHqdB122g: "Tire temperature: axle 2 tire 3",
          "aE05ArsMmmUizi-yBlxGGpg": "Tire temperature: axle 15 tire 3",
          ajbFDc7c6PUCLMu1BJUKdYQ: "Tire temperature: axle 4 tire 3",
          awF7driK_DEKXY_Kmt1i0mg: "Tire temperature: axle 14 tire 4",
          aDO8NxWx690S8VPvFn45NJA: "Tire temperature: axle 1 tire 4",
          aweRcCBktTESBkI4aIIaVxg: "Tire temperature: axle 10 tire 4",
          afymkm9jH_0m_gAZkB2YY7w: "Tire pressure: axle 15 tire 2",
          aS59DbXj9VUeHZw0A81Y5TA: "Tire pressure: axle 5 tire 3",
          ammSx3EpAVEWFRA4yst8hGA: "Tire pressure: axle 1 tire 3",
          aUPhXzwOWIkCmEBKvkVg5Zw: "Tire pressure: axle 13 tire 1",
          "alHeD6taYXEuH3yCaQQ8R-A": "Tire pressure: axle 14 tire 4",
          aDTv46qmi302XziRVk7SOYw: "Tire pressure: axle 1 tire 4",
          "aaw36-92yaUuzvCZoKoiD9g": "Tire pressure: axle 10 tire 4",
          ahx9K_344rU6qFilQAF6Esg: "Tire pressure: axle 6 tire 3",
          aDHfNLzHx0USy7isxSHgT1Q: "Tire pressure: axle 2 tire 4",
          axLqNDg3AF0u4bi4N79kc3g: "Tire pressure: axle 11 tire 3",
          aPww5uoVhKEC7sy5wxF4tbQ: "Tire pressure: axle 5 tire 2",
          aBnIGO8z_BUuqpjfvsIW80g: "Tire pressure: axle 9 tire 4",
          aeo9W40sUCUK5hUKmWWuUWg: "Tire pressure: axle 13 tire 4",
          aWD9ZUNd75kCacEXe4bN97A: "Tire pressure: axle 7 tire 4",
          avpBdnkY5hUqCIEdFINDRPA: "Tire pressure: axle 13 tire 2",
          aTFYkXEL8c0eYh1QXFqZCzw: "Tire pressure: axle 15 tire 4",
          aubbIscaJzEKptmBPdkmukA: "Tire pressure: axle 4 tire 3",
          aucGvS2b7GE2eBWJptDcQTQ: "Tire pressure: axle 3 tire 4",
          aHuKjEY6QYEGRXmat21HiFg: "Tire pressure: axle 3 tire 1",
          azXrGzYd0v0iNR2f1eYxZrw: "Tire pressure: axle 12 tire 1",
          "au2spF4W84E2-12mLeyzC9A": "Tire pressure: axle 7 tire 1",
          a5OQtfETMnEeVAms6MINtMQ: "Tire pressure: axle 2 tire 1",
          "aGQz-0014q0qQuGzLGcjzHw": "Tire pressure: axle 6 tire 4",
          aWh7GmzEY20aZA3C4KSBZuA: "Tire pressure: axle 1 tire 2",
          arJxAG_FB00GwM3N00Y6Whw: "Tire pressure: axle 5 tire 4",
          "aXLrB8-L0kkWwJXrnEdPYvQ": "Tire pressure: axle 3 tire 2",
          awQIRTYlQx02Zl3v9HUrGjQ: "Tire pressure: axle 12 tire 4",
          az5qzThnBY0KSMnwnNyvNkQ: "Tire pressure: axle 10 tire 1",
          "ap8APxcA9sk--x3_taAerkQ": "Tire pressure: axle 8 tire 3",
          aPnpH0F0JQ0q6coWjTvgqHg: "Tire pressure: axle 8 tire 2",
          "aS75tKaxbRE-5K4ZVNTFbWg": "Tire pressure: axle 11 tire 4",
          aCzHq1tPPBkSxO4mqKYxL_A: "Tire pressure: axle 12 tire 3",
          aXIP7a0nEgU6dxZGxGBXbSw: "Tire pressure: axle 6 tire 1",
          "a9K-yD73p7UelSZLahVvXSw": "Tire pressure: axle 11 tire 2",
          at8jmyXzYGEmpo5LurduU_w: "Tire pressure: axle 6 tire 2",
          aYT21qD9lUkydm5SNLVP2Kw: "Tire pressure: axle 2 tire 2",
          a4hVw9GtnN06ClZbBbuJ_1A: "Tire pressure: axle 5 tire 1",
          "aaN_Fa-6luECCbJc82AF1tA": "Tire pressure: axle 15 tire 1",
          "aKXS14K7z9EmkUaPJzw-_RA": "Tire pressure: axle 15 tire 3",
          "a1dfQ-q5ZRkOMuanRgvu57A": "Tire pressure: axle 12 tire 2",
          "aaHc0-gOrWECbEq4qg02B-A": "Tire pressure: axle 9 tire 3",
          aLQakfX7fFEWfCrAdE7SI7g: "Tire pressure: axle 10 tire 3",
          "aSB58Wc8x1k-cjLKT5BVSQA": "Tire pressure: axle 9 tire 2",
          a6uqOJv4P2EKQo7oBzHckrQ: "Tire pressure: axle 4 tire 2",
          "arq0jP0jTIE-STLy_Irs-Kw": "Tire pressure: axle 14 tire 2",
          aV8WCZOe8Jkynz797aav7WQ: "Tire pressure: axle 9 tire 1",
          acckG84GvXkC94sejQz44Hw: "Tire pressure: axle 11 tire 1",
          a_wS1PWcq70aVdMoGNy676Q: "Tire pressure: axle 4 tire 4",
          aONK3kCogOUuIGdS8hhKGiA: "Tire pressure: axle 7 tire 3",
          aPem32mhR7EmN19W6eD3M8Q: "Tire pressure: axle 8 tire 1",
          ajN885q748kueWd0nNFtatA: "Tire pressure: axle 3 tire 3",
          aM8CUZ103VkuKfuS0wmGYPQ: "Tire pressure: axle 13 tire 3",
          aqnMOJwje1kmfBOwBqj0zLQ: "Tire pressure: axle 2 tire 3",
          "arRAX2-GlvEO5JOzrOW0Nyg": "Tire pressure: axle 4 tire 1",
          aKt5ITkO4kkOKJ_JTuocMmA: "Tire pressure: axle 10 tire 2",
          ayc0vUJCH00qTpvMb6SH59w: "Tire pressure: axle 7 tire 2",
          aj1hqGeelsUWOyPWLFvUs8Q: "Tire pressure: axle 14 tire 1",
          aevn4KPf8bkCJWP5L3mQKAw: "Tire pressure: axle 14 tire 3",
          aIBxsSTHMPUGFY__OvOEqCg: "Tire pressure: axle 8 tire 4",
          axw5pat2bp0ueRduqcJi2KQ: "Tire pressure: axle 1 tire 1",

          /* Trailer 1 */
          "av-7nmyzSDEiBcRDpax9XwQ": "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
          a8W8XrBk65ECpIiSHQrdwpQ: "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
          "a3-guntvtCkKXXimdgESeBw": "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
          ab4_iJdiZjkSi9iywGGgDJA: "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
          aeNBT3_JzWUqoDzot_VVymg: "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
          "aio8G6xm0T0-m6D64eiXq8w": "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
          aSx4sxJmSXEi07kcDyRKDsw: "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
          aJ7REd1YJykupdUhUB4Uezw: "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
          ameT6maBOAkaDtlEnFgJq_Q: "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
          "aR1pR_4OjV0eowFjfY-SasA": "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
          ahYYp6qyrU0y7fHwQ5lxnbQ: "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
          azVdLjnyM1Eupzn8O5vaxtA: "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
          alg5yGb5ZEkaTnIlsEwTghg: "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
          aD5jFsDFrGUapTIotvp_GRQ: "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
          ablV8lrsvDkeiWpnI2QfMPg: "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
          avkkKzpSD50il7J5qmNsIFg: "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
          ae0Lk1q9LZEOO66X4YwWkow: "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
          "afZEy_7Am906-LLC4W6xuUQ": "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
          aw_VEhum4V0qzZbOj1ZH8Pg: "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
          "avfJ95BT-NEyTUbihRKXw5w": "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
          ac98h3XY4lkqBgsykqqw9dg: "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
          av0Wwrr13z0mtn9Cbz91txw: "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
          aNpE8SrX61kmi7vefI82ldw: "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
          aaM2YzIHm4UySm_tI0c3JrA: "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
          "aoXL-czVSe0aFrwEKAUgpSQ": "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
          aiImdaxpyOUOqHgYiIq9Pdg: "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
          a558xfocfOkqq0RGif3PYkA: "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
          "anGN3cyDOU0-a7xXDZC9FlA": "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
          a2aQWL9vbIEaFtjOIygXpNw: "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
          alTF5vGqw8UKeSUIRQKwyhA: "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
          aYnZufXXYcEm060ZK4tzbww: "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
          altKk6qgEqkSCqVNv26HKMw: "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
          aqfLL9jojEEuRBVVoOnnMvw: "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
          aMf4Mfu2RPkmtN2C4s_yy6g: "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
          aN6xyABRxyU6TnWWGCo48lw: "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
          "aShus-gSfSkS8DWbKTFquew": "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
          "aOtviSvi0hUm7-2trnI8wAw": "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
          aOzYhibYm8Uuyj3bl18lP8w: "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
          "aiUOCYsLw-UuMKXhrzWYNiw": "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
          an9aZLqd5uEyGaX5Qo9xSmw: "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
          "aBXb6Hcojuku-uItx7iSCOA": "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
          "aur1cwwirIk-ym434gRLBVA": "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
          a49vpNDRQoEG50ZdK2p_rXQ: "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
          aUwmJiXOXMEGHoKstyej0nA: "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
          a4SQvHuXgm0qdAa9XMhI5pQ: "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
          ar20m0c8XM0qGYriVvG7d1A: "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
          agJKt4tlDQ0WbpfUQQ3bGew: "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
          ar5iByUEFz0SyJf6Q9BfJtQ: "Peripheral device tire pressure: trailer 1 axle 4 tire 2",

          /* Trailer 2 */
          "agKc5_RtImUOx6AYqAlvt-Q": "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
          a99JAnc5DuEqPdgvELZvgDw: "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
          aPOlQSZzorkSlNQzgUop9ZQ: "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
          aHwFNTYYCzECYpBgbNIznww: "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
          "agpC-PvnSJkW_5ikoOg0WIw": "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
          "aI1bKcTKLukOraSrnmJ-7cg": "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
          adeC918cOXkSNvzZwGVwqGw: "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
          a8mJwVfLLIEGgNDxZaTfNbw: "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
          "a5RV-FSl0BU2B4UVrhY6FsQ": "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
          aT08_83KvnE2dEEfLgcan8w: "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
          aTtkuUj7060ikMkjXseUgOw: "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
          adxBetWHIKkaG3V_ph_BhyQ: "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
          aI8uO2CQ6A0iaD3acPRBKAA: "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
          aDYQobqlAl0m4xH4oUNl1EQ: "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
          aqSYLGYDvjEKnIZQTqLTuLw: "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
          "aIqlzThBFFEqwM5i-pqzSWg": "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
          aOf5V0c5KvEKXPa2uQ9o9qg: "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
          aYEpdhJGKOUSBdb9v1Lbj4A: "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
          "aLdCVnDVWa0GGk8hre-mCtA": "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
          a6RpYQEXpnk6XKcsVRhtY3Q: "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
          aiJy_8EYUg0WF4tf1i2qGfQ: "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
          ag8dvMYb3s02Ndd0Qec8HiQ: "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
          "araR8mswfs06ZH-v-XJAf2w": "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
          aQerXJeXJikO5uvUzeZjAPQ: "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
          aIphJmTIEvUKbnwszf6RYhQ: "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
          azA4EGYVH6kenmA3ccqzeXg: "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
          "a-MeuiogirUureBeU_XpaDA": "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
          "aSr8VyEKyd0-qAhoqbmP7QA": "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
          aq62nuOT02UqIkh3Qb01O2A: "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
          a5C45BLPEREeQEx_KnV4t7g: "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
          aIZx8fruMlkiXwTFdZKB02A: "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
          "aqxP_I0DPqEOE-T2iMgcUfw": "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
          aKIHzl1Or50eKL0kys3wZOg: "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
          a9NB2cZXS90iHPlzgVqjudA: "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
          "anivGk3NBq0WuYWRFsA8i-g": "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
          aRjLg1djVFES9Am9LtfY_Kg: "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
          aFj5MS5cupUeNMW_GYlNGgQ: "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
          ayBB61Dsaa0WfpXoG8ycvpw: "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
          a9c9yPQ0deEmGPomSDFL6nQ: "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
          aLxkwNTgtbUa0d7SptpEqaA: "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
          a6IiOvOrMLUWb6LgS3t6FBA: "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
          "aue4KnLeXXU-vRr3A8Dlkng": "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
          aOVj04lzzsEiBUb7okAkb2w: "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
          "aRk-QrHUlCkGaWL_8wL7kzg": "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
          arVA95TeSZkqOxMDz6ekQJQ: "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
          aRTwuV8X1qEKlWdO6o4SHBA: "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
          aUe4D3OsNhE27OfWNae8gIA: "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
          aeTuqJroVW0WsPPnBqGcwLg: "Peripheral device tire pressure: trailer 2 axle 6 tire 1",

          /* Trailer 3 */
          ab2Fqg2bNbUeoOQIV4BTagQ: "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
          awEAqh8jieEKU0AWpFLE9Jg: "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
          araMSRvJd0kG9ECEeVa_aTg: "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
          a_bLviqmfikeQMCRl4YjwwA: "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
          aCykppg1KK0CX1DRiPH5Y_g: "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
          aiYrrhzrvVUG3bUXXWOwpXw: "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
          "aFlrw9w5Yl0q-x0lSr6d-KQ": "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
          aF7y6hQj_BUKiP1NpbvstjQ: "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
          aNkfmmDIDwkiXoHs9l8fOrQ: "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
          axV75zfN45EOWkH8xGrOtMA: "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
          aVJsMFfpta0SzH4Zax_9TvQ: "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
          ay5N4RCJAO0CHTIjL4Q1WEg: "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
          "aNEpSh7WjykmNTIkz-wi09g": "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
          a5tcYGwmNY0utaI96Hn2G9w: "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
          aOGSppyVNvEeOgZzF35LL4w: "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
          aNGZDIE9fDU2O1p6GI1DINQ: "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
          aJa7BrFr0OE2WbbGvqWwhUA: "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
          aUgl3XsHniUyY6rdX6pFkow: "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
          a5JC7agzX00Soq7rUKLDb1g: "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
          a1Vh9w6oZ80qyX8iKkh5XHw: "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
          aod2F0j_x4UylRNWq_ZlLUQ: "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
          amf_OMGhbe0eRsNeW96qaCw: "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
          aVzc4pgAFskqgh_NVuPZ6EA: "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
          aSM0xROkUAEq1ov4J1jgUkw: "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
          aNOCr8YvRG06wFwY8Vfcfkw: "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
          "aDQ-H7PB2pU6oYBt0bpvyww": "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
          agiCJlft9hk6_DihsQGhbeg: "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
          axnU95osj8EKTMkEbHmzYKQ: "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
          aTI2eo8EHyUWjRkNcpdNh7Q: "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
          aDm6IIpVhdkWTEUacWcwH4Q: "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
          "a_kan9Gsv3UaJK0vr2C9-XA": "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
          aiz8OvmId9UK6p09S1HLD2g: "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
          "anPQiKKENIEmXr17QW-Lhag": "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
          a48OUjrqX_UWNoWdD8ozPOg: "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
          asV5bF9v710i823ZhMyKPpw: "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
          aQXVqDNqof0y2XnjMaDwgTg: "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
          av9A63iPJKkusDn5HygSr3w: "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
          "a1QxeWa8GN0OCd4BdL-TdcQ": "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
          a3LhPoqp15EqcVIzTpTqmwg: "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
          aSAsD6yIFzEWvIZLwU8pRoQ: "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
          auM8_y6nNJUeII5QcoJwEng: "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
          aGizbe9Fer0ehdZbroM8UcQ: "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
          apUUAYdXOgEOfuq0x1gefwg: "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
          aGZXViyR0n0K9_bS2Ea8kTA: "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
          "aUIercIxRzUOY2Lhuy35f-Q": "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
          aENtMjq048E2Q7L3N4PXDAw: "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
          asx1jEr14akmL4cDyBKCoHQ: "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
          aDhOAu0DTr0uaaN3vDQ_BHA: "Peripheral device tire pressure: trailer 3 axle 3 tire 1",
        },

        /* TempTrac */
        "Peripheral device: reefer temperature zone 4": {
          loc: "Peripheral device: reefer temperature zone 4",
          id: "DiagnosticReeferTemperatureZone4Id",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Peripheral device: reefer temperature zone 2": {
          loc: "Peripheral device: reefer temperature zone 2",
          id: "DiagnosticReeferTemperatureZone2Id",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Peripheral device: reefer temperature zone 3": {
          loc: "Peripheral device: reefer temperature zone 3",
          id: "DiagnosticReeferTemperatureZone3Id",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Peripheral device: reefer temperature zone 1": {
          loc: "Peripheral device: reefer temperature zone 1",
          id: "DiagnosticReeferTemperatureZone1Id",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },

        /* Tractor */
        "Tire temperature: axle 4 tire 2": {
          loc: "Tire temperature: axle 4 tire 2",
          id: "af-aART3R20iqTABMMuOQug",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 4 tire 1": {
          loc: "Tire temperature: axle 4 tire 1",
          id: "aJ5BZCAIRcUOtSQU2ah125Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 2 tire 2": {
          loc: "Tire temperature: axle 2 tire 2",
          id: "aJ6V9PwpaWEK6YwvKSLxuDg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 5 tire 1": {
          loc: "Tire temperature: axle 5 tire 1",
          id: "afTvCGj0LME2nPQ_yi6Zprg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 8 tire 2": {
          loc: "Tire temperature: axle 8 tire 2",
          id: "awgE9H0owikaNhxQp-8ORrg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 14 tire 3": {
          loc: "Tire temperature: axle 14 tire 3",
          id: "a_QqQSc7prEmssBy2cr4GiQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 15 tire 4": {
          loc: "Tire temperature: axle 15 tire 4",
          id: "acHLkVisytUqE-SFYpyke-Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 8 tire 3": {
          loc: "Tire temperature: axle 8 tire 3",
          id: "aksQyj4DQBky5HyURZiKYwg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 10 tire 2": {
          loc: "Tire temperature: axle 10 tire 2",
          id: "aSLXud_CMGEiskiVrUGfDZw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 5 tire 3": {
          loc: "Tire temperature: axle 5 tire 3",
          id: "a1hqxUSZzJ0S2JyYEyo_VeQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 10 tire 3": {
          loc: "Tire temperature: axle 10 tire 3",
          id: "abmqqxx7dREm4XCdaJagnKw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 5 tire 2": {
          loc: "Tire temperature: axle 5 tire 2",
          id: "a1-Xqquf_Pk2BLTSnpF2OLw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 13 tire 1": {
          loc: "Tire temperature: axle 13 tire 1",
          id: "anVIOrFs7-UC7rjVos2KK0w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 7 tire 2": {
          loc: "Tire temperature: axle 7 tire 2",
          id: "aR1xLRYgjQ0ilhjk5Af9ijQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 7 tire 4": {
          loc: "Tire temperature: axle 7 tire 4",
          id: "aCIDQe8BU90KbPzprepe2pA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 11 tire 3": {
          loc: "Tire temperature: axle 11 tire 3",
          id: "aj0WbeSf22U-D90H53AUPGw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 14 tire 2": {
          loc: "Tire temperature: axle 14 tire 2",
          id: "aMcfoAqAI_0qftES-nOkdXg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 6 tire 1": {
          loc: "Tire temperature: axle 6 tire 1",
          id: "a2DB7ykkjnEmPsEUM8ax4Qw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 9 tire 1": {
          loc: "Tire temperature: axle 9 tire 1",
          id: "a7hDn0EY6kk-LJUhgheNKgw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 9 tire 2": {
          loc: "Tire temperature: axle 9 tire 2",
          id: "a_x2ggICa9EaLmUmijtxVxw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 9 tire 4": {
          loc: "Tire temperature: axle 9 tire 4",
          id: "aySNM1EiJRUW5c0m_2MNk_Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 3 tire 4": {
          loc: "Tire temperature: axle 3 tire 4",
          id: "a5zQnIKLK1EGJc0y74FM76Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 5 tire 4": {
          loc: "Tire temperature: axle 5 tire 4",
          id: "auMikJD79gk-SaVPlRyg0Cg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 10 tire 1": {
          loc: "Tire temperature: axle 10 tire 1",
          id: "aKe_wiJuqJE2jNV0ihv4eeA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 7 tire 1": {
          loc: "Tire temperature: axle 7 tire 1",
          id: "azHJzyul44Um0gmMP5OKW8g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 3 tire 2": {
          loc: "Tire temperature: axle 3 tire 2",
          id: "a3_U0ud3wbkKNvGRSVJATOg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 11 tire 1": {
          loc: "Tire temperature: axle 11 tire 1",
          id: "adq1VIj3Mbk-ZKmYOnn5Djw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 12 tire 4": {
          loc: "Tire temperature: axle 12 tire 4",
          id: "atHQLX-xXBEalP2aOLb2cNA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 15 tire 2": {
          loc: "Tire temperature: axle 15 tire 2",
          id: "a_IYsTjcEMEm762d24DFUdA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 4 tire 4": {
          loc: "Tire temperature: axle 4 tire 4",
          id: "afGmJoFp5M02mSmv6iumwfQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 2 tire 4": {
          loc: "Tire temperature: axle 2 tire 4",
          id: "alXGwTauFBkq48G840Hni1g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 13 tire 3": {
          loc: "Tire temperature: axle 13 tire 3",
          id: "aoMlYiDcBlk-cPnLliFLTtw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 8 tire 4": {
          loc: "Tire temperature: axle 8 tire 4",
          id: "ajMeii2CJykmBHHNtskGPyQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 11 tire 2": {
          loc: "Tire temperature: axle 11 tire 2",
          id: "afbN7sX31KEqhoHTZAIKFnw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 6 tire 3": {
          loc: "Tire temperature: axle 6 tire 3",
          id: "apPupKJzE6Um-PHd2-XGVbQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 13 tire 4": {
          loc: "Tire temperature: axle 13 tire 4",
          id: "arrO0vmDWZEOIFnfLvRMxkQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 1 tire 2": {
          loc: "Tire temperature: axle 1 tire 2",
          id: "a1ZcS5E35KkOVBXxcqSCihQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 3 tire 1": {
          loc: "Tire temperature: axle 3 tire 1",
          id: "a2Sj4el_ot0akRIAFB3j3dA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 9 tire 3": {
          loc: "Tire temperature: axle 9 tire 3",
          id: "amhgewWRlz0e8M4VA1o1tkQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 12 tire 3": {
          loc: "Tire temperature: axle 12 tire 3",
          id: "aV00Fh2yuRk2a-pCjfLbOAQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 13 tire 2": {
          loc: "Tire temperature: axle 13 tire 2",
          id: "aGv5W2jGib0qGmZFTthHqxg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 1 tire 1": {
          loc: "Tire temperature: axle 1 tire 1",
          id: "aMc7Tbwr7oEG_65ZlQIhe8A",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 1 tire 3": {
          loc: "Tire temperature: axle 1 tire 3",
          id: "ayIh-pPu-BUyW35gJQDE-eQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 6 tire 2": {
          loc: "Tire temperature: axle 6 tire 2",
          id: "alIBMrLvBRkGoJZwLXT4aNA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 12 tire 1": {
          loc: "Tire temperature: axle 12 tire 1",
          id: "a-Z4vcpJrK0OcAZ4JV5-DUA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 3 tire 3": {
          loc: "Tire temperature: axle 3 tire 3",
          id: "ahQIxeVmRhUWwja1X5JWRmw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 12 tire 2": {
          loc: "Tire temperature: axle 12 tire 2",
          id: "aPtrBlvZnR0GGJbSgpf7YtA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 11 tire 4": {
          loc: "Tire temperature: axle 11 tire 4",
          id: "aSEhZa5CWvEWFPLorvUtl9A",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 8 tire 1": {
          loc: "Tire temperature: axle 8 tire 1",
          id: "aVyx_amL1G067I7yelZtTqg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 2 tire 1": {
          loc: "Tire temperature: axle 2 tire 1",
          id: "aB1AI1v7VZEuEpL9DL2pX5w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 7 tire 3": {
          loc: "Tire temperature: axle 7 tire 3",
          id: "aJcg4DnM3AUaZQc-dTwheRA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 6 tire 4": {
          loc: "Tire temperature: axle 6 tire 4",
          id: "aRQu7NYg_rUykKdD5aLB3Tg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 15 tire 1": {
          loc: "Tire temperature: axle 15 tire 1",
          id: "avTVfxhYRP0K5Fdf2UnmVFw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 14 tire 1": {
          loc: "Tire temperature: axle 14 tire 1",
          id: "aN8DkqeyfYkGUZdmBUqL7WA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 2 tire 3": {
          loc: "Tire temperature: axle 2 tire 3",
          id: "ajfPPsCzHZkOMSeHqdB122g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 15 tire 3": {
          loc: "Tire temperature: axle 15 tire 3",
          id: "aE05ArsMmmUizi-yBlxGGpg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 4 tire 3": {
          loc: "Tire temperature: axle 4 tire 3",
          id: "ajbFDc7c6PUCLMu1BJUKdYQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 14 tire 4": {
          loc: "Tire temperature: axle 14 tire 4",
          id: "awF7driK_DEKXY_Kmt1i0mg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 1 tire 4": {
          loc: "Tire temperature: axle 1 tire 4",
          id: "aDO8NxWx690S8VPvFn45NJA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },
        "Tire temperature: axle 10 tire 4": {
          loc: "Tire temperature: axle 10 tire 4",
          id: "aweRcCBktTESBkI4aIIaVxg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "tractor",
        },

        "Tire pressure: axle 15 tire 2": {
          loc: "Tire pressure: axle 15 tire 2",
          id: "afymkm9jH_0m_gAZkB2YY7w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 5 tire 3": {
          loc: "Tire pressure: axle 5 tire 3",
          id: "aS59DbXj9VUeHZw0A81Y5TA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 1 tire 3": {
          loc: "Tire pressure: axle 1 tire 3",
          id: "ammSx3EpAVEWFRA4yst8hGA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 13 tire 1": {
          loc: "Tire pressure: axle 13 tire 1",
          id: "aUPhXzwOWIkCmEBKvkVg5Zw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 14 tire 4": {
          loc: "Tire pressure: axle 14 tire 4",
          id: "alHeD6taYXEuH3yCaQQ8R-A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 1 tire 4": {
          loc: "Tire pressure: axle 1 tire 4",
          id: "aDTv46qmi302XziRVk7SOYw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 10 tire 4": {
          loc: "Tire pressure: axle 10 tire 4",
          id: "aaw36-92yaUuzvCZoKoiD9g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 6 tire 3": {
          loc: "Tire pressure: axle 6 tire 3",
          id: "ahx9K_344rU6qFilQAF6Esg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 2 tire 4": {
          loc: "Tire pressure: axle 2 tire 4",
          id: "aDHfNLzHx0USy7isxSHgT1Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 11 tire 3": {
          loc: "Tire pressure: axle 11 tire 3",
          id: "axLqNDg3AF0u4bi4N79kc3g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 5 tire 2": {
          loc: "Tire pressure: axle 5 tire 2",
          id: "aPww5uoVhKEC7sy5wxF4tbQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 9 tire 4": {
          loc: "Tire pressure: axle 9 tire 4",
          id: "aBnIGO8z_BUuqpjfvsIW80g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 13 tire 4": {
          loc: "Tire pressure: axle 13 tire 4",
          id: "aeo9W40sUCUK5hUKmWWuUWg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 7 tire 4": {
          loc: "Tire pressure: axle 7 tire 4",
          id: "aWD9ZUNd75kCacEXe4bN97A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 13 tire 2": {
          loc: "Tire pressure: axle 13 tire 2",
          id: "avpBdnkY5hUqCIEdFINDRPA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 15 tire 4": {
          loc: "Tire pressure: axle 15 tire 4",
          id: "aTFYkXEL8c0eYh1QXFqZCzw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 4 tire 3": {
          loc: "Tire pressure: axle 4 tire 3",
          id: "aubbIscaJzEKptmBPdkmukA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 3 tire 4": {
          loc: "Tire pressure: axle 3 tire 4",
          id: "aucGvS2b7GE2eBWJptDcQTQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 3 tire 1": {
          loc: "Tire pressure: axle 3 tire 1",
          id: "aHuKjEY6QYEGRXmat21HiFg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 12 tire 1": {
          loc: "Tire pressure: axle 12 tire 1",
          id: "azXrGzYd0v0iNR2f1eYxZrw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 7 tire 1": {
          loc: "Tire pressure: axle 7 tire 1",
          id: "au2spF4W84E2-12mLeyzC9A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 2 tire 1": {
          loc: "Tire pressure: axle 2 tire 1",
          id: "a5OQtfETMnEeVAms6MINtMQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 6 tire 4": {
          loc: "Tire pressure: axle 6 tire 4",
          id: "aGQz-0014q0qQuGzLGcjzHw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 1 tire 2": {
          loc: "Tire pressure: axle 1 tire 2",
          id: "aWh7GmzEY20aZA3C4KSBZuA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 5 tire 4": {
          loc: "Tire pressure: axle 5 tire 4",
          id: "arJxAG_FB00GwM3N00Y6Whw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 3 tire 2": {
          loc: "Tire pressure: axle 3 tire 2",
          id: "aXLrB8-L0kkWwJXrnEdPYvQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 12 tire 4": {
          loc: "Tire pressure: axle 12 tire 4",
          id: "awQIRTYlQx02Zl3v9HUrGjQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 10 tire 1": {
          loc: "Tire pressure: axle 10 tire 1",
          id: "az5qzThnBY0KSMnwnNyvNkQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 8 tire 3": {
          loc: "Tire pressure: axle 8 tire 3",
          id: "ap8APxcA9sk--x3_taAerkQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 8 tire 2": {
          loc: "Tire pressure: axle 8 tire 2",
          id: "aPnpH0F0JQ0q6coWjTvgqHg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 11 tire 4": {
          loc: "Tire pressure: axle 11 tire 4",
          id: "aS75tKaxbRE-5K4ZVNTFbWg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 12 tire 3": {
          loc: "Tire pressure: axle 12 tire 3",
          id: "aCzHq1tPPBkSxO4mqKYxL_A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 6 tire 1": {
          loc: "Tire pressure: axle 6 tire 1",
          id: "aXIP7a0nEgU6dxZGxGBXbSw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 11 tire 2": {
          loc: "Tire pressure: axle 11 tire 2",
          id: "a9K-yD73p7UelSZLahVvXSw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 6 tire 2": {
          loc: "Tire pressure: axle 6 tire 2",
          id: "at8jmyXzYGEmpo5LurduU_w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 2 tire 2": {
          loc: "Tire pressure: axle 2 tire 2",
          id: "aYT21qD9lUkydm5SNLVP2Kw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 5 tire 1": {
          loc: "Tire pressure: axle 5 tire 1",
          id: "a4hVw9GtnN06ClZbBbuJ_1A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 15 tire 1": {
          loc: "Tire pressure: axle 15 tire 1",
          id: "aaN_Fa-6luECCbJc82AF1tA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 15 tire 3": {
          loc: "Tire pressure: axle 15 tire 3",
          id: "aKXS14K7z9EmkUaPJzw-_RA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 12 tire 2": {
          loc: "Tire pressure: axle 12 tire 2",
          id: "a1dfQ-q5ZRkOMuanRgvu57A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 9 tire 3": {
          loc: "Tire pressure: axle 9 tire 3",
          id: "aaHc0-gOrWECbEq4qg02B-A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 10 tire 3": {
          loc: "Tire pressure: axle 10 tire 3",
          id: "aLQakfX7fFEWfCrAdE7SI7g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 9 tire 2": {
          loc: "Tire pressure: axle 9 tire 2",
          id: "aSB58Wc8x1k-cjLKT5BVSQA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 4 tire 2": {
          loc: "Tire pressure: axle 4 tire 2",
          id: "a6uqOJv4P2EKQo7oBzHckrQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 14 tire 2": {
          loc: "Tire pressure: axle 14 tire 2",
          id: "arq0jP0jTIE-STLy_Irs-Kw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 9 tire 1": {
          loc: "Tire pressure: axle 9 tire 1",
          id: "aV8WCZOe8Jkynz797aav7WQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 11 tire 1": {
          loc: "Tire pressure: axle 11 tire 1",
          id: "acckG84GvXkC94sejQz44Hw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 4 tire 4": {
          loc: "Tire pressure: axle 4 tire 4",
          id: "a_wS1PWcq70aVdMoGNy676Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 7 tire 3": {
          loc: "Tire pressure: axle 7 tire 3",
          id: "aONK3kCogOUuIGdS8hhKGiA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 8 tire 1": {
          loc: "Tire pressure: axle 8 tire 1",
          id: "aPem32mhR7EmN19W6eD3M8Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 3 tire 3": {
          loc: "Tire pressure: axle 3 tire 3",
          id: "ajN885q748kueWd0nNFtatA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 13 tire 3": {
          loc: "Tire pressure: axle 13 tire 3",
          id: "aM8CUZ103VkuKfuS0wmGYPQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 2 tire 3": {
          loc: "Tire pressure: axle 2 tire 3",
          id: "aqnMOJwje1kmfBOwBqj0zLQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 4 tire 1": {
          loc: "Tire pressure: axle 4 tire 1",
          id: "arRAX2-GlvEO5JOzrOW0Nyg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 10 tire 2": {
          loc: "Tire pressure: axle 10 tire 2",
          id: "aKt5ITkO4kkOKJ_JTuocMmA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 7 tire 2": {
          loc: "Tire pressure: axle 7 tire 2",
          id: "ayc0vUJCH00qTpvMb6SH59w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 14 tire 1": {
          loc: "Tire pressure: axle 14 tire 1",
          id: "aj1hqGeelsUWOyPWLFvUs8Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 14 tire 3": {
          loc: "Tire pressure: axle 14 tire 3",
          id: "aevn4KPf8bkCJWP5L3mQKAw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 8 tire 4": {
          loc: "Tire pressure: axle 8 tire 4",
          id: "aIBxsSTHMPUGFY__OvOEqCg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },
        "Tire pressure: axle 1 tire 1": {
          loc: "Tire pressure: axle 1 tire 1",
          id: "axw5pat2bp0ueRduqcJi2KQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "tractor",
        },

        /* Trailer 1 */
        "Peripheral device tire temperature: trailer 1 axle 4 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
          id: "av-7nmyzSDEiBcRDpax9XwQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 3 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
          id: "a8W8XrBk65ECpIiSHQrdwpQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 4 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
          id: "a3-guntvtCkKXXimdgESeBw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 2 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
          id: "ab4_iJdiZjkSi9iywGGgDJA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 4 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
          id: "aeNBT3_JzWUqoDzot_VVymg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 5 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
          id: "aio8G6xm0T0-m6D64eiXq8w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 1 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
          id: "aSx4sxJmSXEi07kcDyRKDsw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 5 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
          id: "aJ7REd1YJykupdUhUB4Uezw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 2 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
          id: "ameT6maBOAkaDtlEnFgJq_Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 1 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
          id: "aR1pR_4OjV0eowFjfY-SasA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 6 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
          id: "ahYYp6qyrU0y7fHwQ5lxnbQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 2 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
          id: "azVdLjnyM1Eupzn8O5vaxtA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 6 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
          id: "alg5yGb5ZEkaTnIlsEwTghg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 2 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
          id: "aD5jFsDFrGUapTIotvp_GRQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 1 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
          id: "ablV8lrsvDkeiWpnI2QfMPg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 1 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
          id: "avkkKzpSD50il7J5qmNsIFg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 5 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
          id: "ae0Lk1q9LZEOO66X4YwWkow",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 5 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
          id: "afZEy_7Am906-LLC4W6xuUQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 3 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
          id: "aw_VEhum4V0qzZbOj1ZH8Pg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 3 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
          id: "avfJ95BT-NEyTUbihRKXw5w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 6 tire 3": {
          loc: "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
          id: "ac98h3XY4lkqBgsykqqw9dg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 3 tire 1": {
          loc: "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
          id: "av0Wwrr13z0mtn9Cbz91txw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 4 tire 2": {
          loc: "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
          id: "aNpE8SrX61kmi7vefI82ldw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },
        "Peripheral device tire temperature: trailer 1 axle 6 tire 4": {
          loc: "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
          id: "aaM2YzIHm4UySm_tI0c3JrA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer1",
        },

        "Peripheral device tire pressure: trailer 1 axle 4 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
          id: "aoXL-czVSe0aFrwEKAUgpSQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 1 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
          id: "aiImdaxpyOUOqHgYiIq9Pdg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 5 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
          id: "a558xfocfOkqq0RGif3PYkA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 1 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
          id: "anGN3cyDOU0-a7xXDZC9FlA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 2 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
          id: "a2aQWL9vbIEaFtjOIygXpNw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 1 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
          id: "alTF5vGqw8UKeSUIRQKwyhA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 3 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
          id: "aYnZufXXYcEm060ZK4tzbww",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 5 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
          id: "altKk6qgEqkSCqVNv26HKMw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 6 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
          id: "aqfLL9jojEEuRBVVoOnnMvw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 3 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
          id: "aMf4Mfu2RPkmtN2C4s_yy6g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 4 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
          id: "aN6xyABRxyU6TnWWGCo48lw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 6 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
          id: "aShus-gSfSkS8DWbKTFquew",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 5 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
          id: "aOtviSvi0hUm7-2trnI8wAw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 1 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
          id: "aOzYhibYm8Uuyj3bl18lP8w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 2 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
          id: "aiUOCYsLw-UuMKXhrzWYNiw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 5 tire 3": {
          loc: "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
          id: "an9aZLqd5uEyGaX5Qo9xSmw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 3 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
          id: "aBXb6Hcojuku-uItx7iSCOA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 2 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
          id: "aur1cwwirIk-ym434gRLBVA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 6 tire 4": {
          loc: "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
          id: "a49vpNDRQoEG50ZdK2p_rXQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 6 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
          id: "aUwmJiXOXMEGHoKstyej0nA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 2 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
          id: "a4SQvHuXgm0qdAa9XMhI5pQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 4 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
          id: "ar20m0c8XM0qGYriVvG7d1A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 3 tire 1": {
          loc: "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
          id: "agJKt4tlDQ0WbpfUQQ3bGew",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },
        "Peripheral device tire pressure: trailer 1 axle 4 tire 2": {
          loc: "Peripheral device tire pressure: trailer 1 axle 4 tire 2",
          id: "ar5iByUEFz0SyJf6Q9BfJtQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer1",
        },

        /* Trailer 2 */
        "Peripheral device tire temperature: trailer 2 axle 5 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
          id: "agKc5_RtImUOx6AYqAlvt-Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 3 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
          id: "a99JAnc5DuEqPdgvELZvgDw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 4 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
          id: "aPOlQSZzorkSlNQzgUop9ZQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 6 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
          id: "aHwFNTYYCzECYpBgbNIznww",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 2 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
          id: "agpC-PvnSJkW_5ikoOg0WIw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 1 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
          id: "aI1bKcTKLukOraSrnmJ-7cg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 2 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
          id: "adeC918cOXkSNvzZwGVwqGw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 3 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
          id: "a8mJwVfLLIEGgNDxZaTfNbw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 3 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
          id: "a5RV-FSl0BU2B4UVrhY6FsQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 6 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
          id: "aT08_83KvnE2dEEfLgcan8w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 1 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
          id: "aTtkuUj7060ikMkjXseUgOw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 2 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
          id: "adxBetWHIKkaG3V_ph_BhyQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 4 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
          id: "aI8uO2CQ6A0iaD3acPRBKAA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 6 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
          id: "aDYQobqlAl0m4xH4oUNl1EQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 1 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
          id: "aqSYLGYDvjEKnIZQTqLTuLw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 6 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
          id: "aIqlzThBFFEqwM5i-pqzSWg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 3 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
          id: "aOf5V0c5KvEKXPa2uQ9o9qg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 5 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
          id: "aYEpdhJGKOUSBdb9v1Lbj4A",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 4 tire 3": {
          loc: "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
          id: "aLdCVnDVWa0GGk8hre-mCtA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 2 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
          id: "a6RpYQEXpnk6XKcsVRhtY3Q",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 5 tire 2": {
          loc: "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
          id: "aiJy_8EYUg0WF4tf1i2qGfQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 4 tire 4": {
          loc: "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
          id: "ag8dvMYb3s02Ndd0Qec8HiQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 1 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
          id: "araR8mswfs06ZH-v-XJAf2w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire temperature: trailer 2 axle 5 tire 1": {
          loc: "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
          id: "aQerXJeXJikO5uvUzeZjAPQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 3 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
          id: "aIphJmTIEvUKbnwszf6RYhQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 5 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
          id: "azA4EGYVH6kenmA3ccqzeXg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 2 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
          id: "a-MeuiogirUureBeU_XpaDA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 4 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
          id: "aSr8VyEKyd0-qAhoqbmP7QA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },

        "Peripheral device tire pressure: trailer 2 axle 5 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
          id: "aq62nuOT02UqIkh3Qb01O2A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 6 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
          id: "a5C45BLPEREeQEx_KnV4t7g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 5 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
          id: "aIZx8fruMlkiXwTFdZKB02A",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 1 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
          id: "aqxP_I0DPqEOE-T2iMgcUfw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 1 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
          id: "aKIHzl1Or50eKL0kys3wZOg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 4 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
          id: "a9NB2cZXS90iHPlzgVqjudA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 1 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
          id: "anivGk3NBq0WuYWRFsA8i-g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 2 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
          id: "aRjLg1djVFES9Am9LtfY_Kg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 3 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
          id: "aFj5MS5cupUeNMW_GYlNGgQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 6 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
          id: "ayBB61Dsaa0WfpXoG8ycvpw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 4 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
          id: "a9c9yPQ0deEmGPomSDFL6nQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 6 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
          id: "aLxkwNTgtbUa0d7SptpEqaA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 3 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
          id: "a6IiOvOrMLUWb6LgS3t6FBA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 2 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
          id: "aue4KnLeXXU-vRr3A8Dlkng",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 5 tire 2": {
          loc: "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
          id: "aOVj04lzzsEiBUb7okAkb2w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 4 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
          id: "aRk-QrHUlCkGaWL_8wL7kzg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 2 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
          id: "arVA95TeSZkqOxMDz6ekQJQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 1 tire 4": {
          loc: "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
          id: "aRTwuV8X1qEKlWdO6o4SHBA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 3 tire 3": {
          loc: "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
          id: "aUe4D3OsNhE27OfWNae8gIA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },
        "Peripheral device tire pressure: trailer 2 axle 6 tire 1": {
          loc: "Peripheral device tire pressure: trailer 2 axle 6 tire 1",
          id: "aeTuqJroVW0WsPPnBqGcwLg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer2",
        },

        /* Trailer 3 */
        "Peripheral device tire temperature: trailer 3 axle 1 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
          id: "ab2Fqg2bNbUeoOQIV4BTagQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 5 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
          id: "awEAqh8jieEKU0AWpFLE9Jg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 3 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
          id: "araMSRvJd0kG9ECEeVa_aTg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 2 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
          id: "a_bLviqmfikeQMCRl4YjwwA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 5 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
          id: "aCykppg1KK0CX1DRiPH5Y_g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 2 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
          id: "aiYrrhzrvVUG3bUXXWOwpXw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 3 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
          id: "aFlrw9w5Yl0q-x0lSr6d-KQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 1 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
          id: "aF7y6hQj_BUKiP1NpbvstjQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 5 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
          id: "aNkfmmDIDwkiXoHs9l8fOrQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 6 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
          id: "axV75zfN45EOWkH8xGrOtMA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 3 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
          id: "aVJsMFfpta0SzH4Zax_9TvQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 6 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
          id: "ay5N4RCJAO0CHTIjL4Q1WEg",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 3 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
          id: "aNEpSh7WjykmNTIkz-wi09g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 5 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
          id: "a5tcYGwmNY0utaI96Hn2G9w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 6 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
          id: "aOGSppyVNvEeOgZzF35LL4w",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 4 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
          id: "aNGZDIE9fDU2O1p6GI1DINQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 4 tire 4": {
          loc: "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
          id: "aJa7BrFr0OE2WbbGvqWwhUA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 1 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
          id: "aUgl3XsHniUyY6rdX6pFkow",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 2 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
          id: "a5JC7agzX00Soq7rUKLDb1g",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 6 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
          id: "a1Vh9w6oZ80qyX8iKkh5XHw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 2 tire 2": {
          loc: "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
          id: "aod2F0j_x4UylRNWq_ZlLUQ",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 4 tire 1": {
          loc: "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
          id: "amf_OMGhbe0eRsNeW96qaCw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 4 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
          id: "aVzc4pgAFskqgh_NVuPZ6EA",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },
        "Peripheral device tire temperature: trailer 3 axle 1 tire 3": {
          loc: "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
          id: "aSM0xROkUAEq1ov4J1jgUkw",
          unitOfMeasure: "UnitOfMeasureDegreesCelsiusId",
          type: "trailer3",
        },

        "Peripheral device tire pressure: trailer 3 axle 6 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
          id: "aNOCr8YvRG06wFwY8Vfcfkw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 1 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
          id: "aDQ-H7PB2pU6oYBt0bpvyww",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 4 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
          id: "agiCJlft9hk6_DihsQGhbeg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 3 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
          id: "axnU95osj8EKTMkEbHmzYKQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 4 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
          id: "aTI2eo8EHyUWjRkNcpdNh7Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 1 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
          id: "aDm6IIpVhdkWTEUacWcwH4Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 5 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
          id: "a_kan9Gsv3UaJK0vr2C9-XA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 6 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
          id: "aiz8OvmId9UK6p09S1HLD2g",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 5 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
          id: "anPQiKKENIEmXr17QW-Lhag",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 2 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
          id: "a48OUjrqX_UWNoWdD8ozPOg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 5 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
          id: "asV5bF9v710i823ZhMyKPpw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 1 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
          id: "aQXVqDNqof0y2XnjMaDwgTg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 4 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
          id: "av9A63iPJKkusDn5HygSr3w",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 2 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
          id: "a1QxeWa8GN0OCd4BdL-TdcQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 4 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
          id: "a3LhPoqp15EqcVIzTpTqmwg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 2 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
          id: "aSAsD6yIFzEWvIZLwU8pRoQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 3 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
          id: "auM8_y6nNJUeII5QcoJwEng",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 1 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
          id: "aGizbe9Fer0ehdZbroM8UcQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 5 tire 2": {
          loc: "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
          id: "apUUAYdXOgEOfuq0x1gefwg",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 3 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
          id: "aGZXViyR0n0K9_bS2Ea8kTA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 2 tire 3": {
          loc: "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
          id: "aUIercIxRzUOY2Lhuy35f-Q",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 6 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
          id: "aENtMjq048E2Q7L3N4PXDAw",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 6 tire 4": {
          loc: "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
          id: "asx1jEr14akmL4cDyBKCoHQ",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
        "Peripheral device tire pressure: trailer 3 axle 3 tire 1": {
          loc: "Peripheral device tire pressure: trailer 3 axle 3 tire 1",
          id: "aDhOAu0DTr0uaaN3vDQ_BHA",
          unitOfMeasure: "UnitOfMeasurePascalsId",
          type: "trailer3",
        },
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
   *  @returns promise
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
   *  @returns string
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
   * Clear the Sensor data cache of all vehicles
   * IF a SEARCH OPERATION is NOT occuring
   *
   *  @returns boolean
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
   *  @returns promise
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
   * @returns object
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
   *  @returns object
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
   *  @returns void
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

