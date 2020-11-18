/* eslint-disable no-unused-vars */

/**********************************************************************************
 *  App UI Lib
 */
const InitOutputUI = function (my, rootDomObj, containerId, panelLabelId, panelTiteBoldId, panelBtnId, panelId, panelClass, pnlJmprContainerId, pnlJmprMenuId) {

  /**
   *  Private Variables
   */

  this._my = null;
  this._callback = null;
  this._callbackOnDomLoaded = null;
  this._rootElemObj = null;
  this._containerElemObj = null;

  this._panelOpenCloseBtnElemObj = null;
  this._panelElemObj = null;
  this._panelClosedClass = "";

  this._panelLabelId = "";
  this._panelLabelObj = null;
  this._panelTitleBoldId = "";
  this._panelTitleBoldObj = null;

  this._pnlJmprContainerElemObj = null;
  this._pnlJmprMenuObj = null;

  this._lastReadTimestampUnix = 0;

  this.init = function (callback) {
    const me = this;

    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    // Init DomLoaded Handler
    window.initOnDomLoad = me.onDomLoad.bind(this);

    // Invoke callback if provided
    if (me._callback) {
      me._callback();
      me._callback = null;
    }
  };

  // Update Lib with reference to dynamically loaded Elements
  this.onDomLoad = function () {
    const me = this;

    me._panelLabelObj = me._containerElemObj.querySelector(me._panelLabelId);
    me._panelTitleBoldObj = me._containerElemObj.querySelector(me._panelTitleBoldId);

    // Invoke callback if provided
    if (me._callbackOnDomLoaded) {
      me._callbackOnDomLoaded();
      me._callbackOnDomLoaded = null;
    }
  };

  this.resetUI = function (newSectionId, callback) {
    const me = this;
    const rootEl = me._containerElemObj;
    const sectionIdAttrName = "data-template-id";
    const currentSectionId = rootEl.getAttribute(sectionIdAttrName) !== null ? rootEl.getAttribute(sectionIdAttrName) : "";

    // Required section template already loaded, so invoke callback right away
    if (newSectionId && callback && typeof callback === "function" && currentSectionId === newSectionId) {
      callback();
    }
    // Apply section template content + Store callback invoked by onDomLoad() after content loaded in DOM
    else if (rootEl && newSectionId && me._callbackOnDomLoaded === null) {
      me._callbackOnDomLoaded = callback && typeof callback === "function" ? callback : null;
      rootEl.setAttribute(sectionIdAttrName, newSectionId);
      rootEl.innerHTML = me._getContent(newSectionId) + me._getContent("dom-loader-widget");
    }
  };

  this.showError = function (msg) {
    const me = this;

    me.resetUI("skeleton-info-error-html", () => {
      const labelEl = me._panelLabelObj;
      const errorEl = me._panelTitleBoldObj;

      if (labelEl && errorEl) {
        if (!labelEl.classList.contains("hidden")) {
          labelEl.classList.add("hidden");          // Hide what we dont need
        }
        if (errorEl.classList.contains("hidden")) {
          errorEl.classList.remove("hidden");       // Show what we do need
        }
        console.log("==== " + my.tr("error_app_title") + ": " + msg.replace(/\<br \/\>/g, " "));
        errorEl.innerHTML = my.tr("error_title") + ":<br />" + msg;
      }
    });
  };

  this.showMsg = function (msg) {
    const me = this;

    me.resetUI("skeleton-info-error-html", () => {
      const labelEl = me._panelLabelObj;
      const errorEl = me._panelTitleBoldObj;

      if (labelEl && errorEl) {
        if (!errorEl.classList.contains("hidden")) {
          errorEl.classList.add("hidden");          // Hide what we dont need
        }
        if (labelEl.classList.contains("hidden")) {
          labelEl.classList.remove("hidden");       // Show what we do need
        }
        labelEl.innerHTML = msg;
      }
    });
  };

  this.renderPanelHTML = function () {
    const me = this;
    const my = me._my;
    const rootEl = me._containerElemObj;
    const watchlistData = my.storage.sensorData.watchlistData;
    let contentHtml = "";

    if (typeof watchlistData === "undefined" ||
      typeof watchlistData.index === "undefined" ||
      !Array.isArray(watchlistData.index) ||
      !watchlistData.index.length) {
      return;
    }

    me.resetUI("skeleton-vehicle-sensor-data-html", () => {
      for (const vehId of watchlistData.index) {
        const vehName = watchlistData[vehId].name;
        const vehSpeed = watchlistData[vehId].speed;
        const vehPanelContentId = my.vehPanelContentIdPrefix + vehId;

        if (!watchlistData[vehId].type.includes("watchlist")) { continue; }

        // Add Vehicle to Panel Jumper Widget, if sensor data content in Panel UI
        setTimeout(function () {
          if (document.getElementById(vehPanelContentId)) {
            me.panelVehJumper.add(vehId, vehName);
          }
        }, 1000);

        // Generate Panel HTML content based on content status
        // Status:
        //    "BUSY"     - Searching for NEW data
        //    "BUSY-NEW" - Searching for NEW data, But STALE data found
        //    "NOTFOUND" - No Sensors Found
        //    "FOUND"    - Found Sensor data
        //
        switch (my.app.getCachedSensorDataStatusForVeh(vehId, vehName)) {
          case "BUSY":
            contentHtml += me._getContent("skeleton-header", {
              vehId: vehId,
              vehPanelContentId: vehPanelContentId,
              titleClassHtml: ' class="info"',
              titleHtml: my.tr("sensors_menuitm_searching_msg").replace("{veh}", vehName),
              vehNameHtml: "",
              vehSpeedHtml: "",
              sensorDataHtml: ""
            });
            break;

          case "BUSY-NEW":
          case "FOUND":
            contentHtml += me._getContent("skeleton-header", {
              vehId: vehId,
              vehPanelContentId: vehPanelContentId,
              titleClassHtml: "",
              titleHtml: my.tr("panel_title"),
              vehNameHtml: vehName,
              vehSpeedHtml: vehSpeed ? vehSpeed + " km/h" : "",
              sensorDataHtml: me.getHtmlFromSensorData(vehId, vehName)
            });
            break;

          case "NOTFOUND":
            contentHtml += me._getContent("skeleton-header", {
              vehId: vehId,
              vehPanelContentId: vehPanelContentId,
              titleClassHtml: ' class="info"',
              titleHtml: my.tr("sensors_menuitm_not_Found_msg").replace("{veh}", vehName),
              vehNameHtml: "",
              vehSpeedHtml: "",
              sensorDataHtml: me._getContent("close-button-html", { vehId: vehId })
            });
            break;
        }
      }

      if (contentHtml) {
        rootEl.innerHTML = contentHtml;
      }
    });
  };

  this.renderMapAlerts = function () {
    const me = this;
    const my = me._my;
    const watchlistData = my.storage.sensorData.watchlistData;
    const mapAlertMarkers = my.mapAlertMarkers;

    if (typeof watchlistData === "undefined" ||
      typeof watchlistData.index === "undefined" ||
      !Array.isArray(watchlistData.index) ||
      !watchlistData.index.length) {
      return;
    }

    for (const vehId of watchlistData.index) {
      const locLat = watchlistData[vehId].loc.lat;
      const locLng = watchlistData[vehId].loc.lng;
      const alertlevel = watchlistData[vehId].alertlevel;
      const vehName = watchlistData[vehId].name;

      // Only look at Alerts
      if (!watchlistData[vehId].type.includes("alert")) { continue; }

      // Remove old marker from map
      if (typeof mapAlertMarkers[vehId] !== "undefined") {
        mapAlertMarkers[vehId].remove();
      }

      mapAlertMarkers[vehId] = my.service.canvas.marker({
        lat: locLat,
        lng: locLng
      },
        my.watchlistAndAlertSettings.mapVehAlertIconWidth,
        my.watchlistAndAlertSettings.mapVehAlertIconHeight,
        my.watchlistAndAlertSettings[alertlevel.iconName],
        my.watchlistAndAlertSettings.mapVehAlertIconZIndex)
        .change({
          "dx": my.watchlistAndAlertSettings.mapVehAlertIconXOffset,
          "dy": my.watchlistAndAlertSettings.mapVehAlertIconYOffset
        })
        .attach("click", () => {

          // If vehicle in Watchlist, jump to it in Panel UI
          if (me.panelVehJumper.menuItemExists(vehId)) {
            me.openPanel();
            me.panelVehJumper.onClickHandler(vehId);
          }
          // Otherwise add veh to Watchlist & show in Panel UI
          else {
            my.app.addWatchlistItem(vehId, vehName);
            my.app.monitorVehSensorDataStatus();

            // SAVE watchlist change Locally & Remotely
            my.app.saveWatchlist("NOW");

            // Jump to vehicle in Panel
            me.panelVehJumper.registerWhenVehAdded(vehId, () => {
              me.panelVehJumper.onClickHandler(vehId);
            });
          }
        })
        .attach("over", (evt) => {

          // Add vehicle name to Sensor location label
          if (alertlevel.tooltip.sensorLocLabel.length && alertlevel.tooltip.sensorLocLabel[0].indexOf("(") === -1) {
            alertlevel.tooltip.sensorLocLabel[0] += " ( " + vehName + " )";
          }

          // Display Tooltip
          my.service.tooltip.showAt({ x: evt.x, y: evt.y }, {
            main: alertlevel.tooltip.title,
            secondary: alertlevel.tooltip.sensorLocLabel,
            additional: alertlevel.tooltip.sensorLocArr
          }, 0);
        })
        .attach("out", () => {
          my.service.tooltip.hide();
        });
    }
  };

  this.showTooltip = function (vehId, vehName) {
    const me = this;
    const my = me._my;
    const tipCfg = JSON.parse(JSON.stringify(my.toolTipSettings.cfg)); // clone config object... never modify the template

    // Register Event
    my.storage.sensorData.vehRegistry.tooltip = vehId;

    // Get Vehicle Sensor Types
    // Status:
    //    "BUSY"     - Searching for NEW data
    //    "BUSY-NEW" - Searching for NEW data, But STALE data found
    //    "NOTFOUND" - No Sensors Found
    //    "FOUND"    - Found Sensor data
    //
    switch (my.app.getCachedSensorDataStatusForVeh(vehId, vehName)) {
      case "BUSY":
        tipCfg.main = my.tr("sensors_tooltip_searching_msg");
        break;

      case "BUSY-NEW":
      case "FOUND":
        const secondaryArr = my.app.fetchSensorTypes(vehId);
        tipCfg.main = my.tr("sensors_tooltip_found_msg");
        tipCfg.secondary = secondaryArr.concat(my.app.fetchAdditionalComponents(vehId));
        tipCfg.additional = [my.tr("sensors_tooltip_found_menuitem_msg")];
        break;

      case "NOTFOUND":
        tipCfg.main = my.tr("sensors_tooltip_not_found_msg");
        break;
    }

    // Update UI
    my.service.tooltip.show(tipCfg, 0);
  };

  this.closeMenuItem = function (vehId) {
    const me = this;

    // Remove vehId from Watchlist
    my.app.delWatchlistItem(vehId);

    // Remove vehId from Panel Jumper Widget
    me.panelVehJumper.del(vehId);

    // Manage UI and Services
    my.app.monitorVehSensorDataStatus();

    // SAVE watchlist change immediately Locally & Remotely
    my.app.saveWatchlist("NOW");
  };

  this.getHtmlFromSensorData = function (vehId, vehName) {
    const me = this;
    const my = me._my;
    const data = me.parseSensorData(my.storage.sensorData.cache[vehId].data);
    let headerTopHtml = "";
    let headerHtml = "";
    let contentHtml = "";

    // Render Headers
    if (data.foundTemptracSensors) {
      headerTopHtml += me._getContent("temptrac-header-top");
      headerHtml += me._getContent("temptrac-header");
    }
    if (data.foundTpmsTempSensors || data.foundTpmsPressSensors) {
      headerTopHtml += me._getContent("tpms-header-top");
      if (data.foundTpmsTempSensors) {
        headerHtml += me._getContent("tpms-header-temp");
      }
      if (data.foundTpmsPressSensors) {
        headerHtml += me._getContent("tpms-header-press");
      }
    }
    my.sdataTools.setFirstTime(vehId, false);

    // Render Content
    data.compIds.map(compId => {
      contentHtml += me._getComponentContentHtml(
        compId,
        (data.compIds.length !== 1),
        data
      );
    });

    return me._getContent("skeleton-body", {
      "vehId": vehId,
      "vehName": vehName,
      "headerTopHtml": headerTopHtml,
      "headerHtml": headerHtml,
      "contentHtml": contentHtml,
      "lastReadTimestamp": data.lastReadTimestamp,
    });
  };

  this.parseSensorData = function (sdata) {
    const me = this;
    const my = me._my;
    const cloneData = JSON.parse(JSON.stringify(sdata)); // clone sensor data object... can't modify the original
    const compIds = cloneData.vehCfg.total === 1 ? [cloneData.vehCfg.active] : cloneData.vehCfg.ids;
    const vehSearchCfg = my.storage.sensorData.cache[cloneData.vehId];
    const isUpdate = !vehSearchCfg.firstTime;
    const fdata = my.app.getFaultData(cloneData.vehId);
    const data = {
      compIds: [],
      vehId: cloneData.vehId,
      vehName: cloneData.vehName,
      lastReadTimestamp: ""
    };
    me._lastReadTimestampUnix = 0;

    // Process Single/Multi-Component source sensor data
    data.foundTemptracSensors = false;
    data.foundTpmsTempSensors = false;
    data.foundTpmsPressSensors = false;
    compIds.map(compId => {

      // Merge in cached Fault/Alert data into sensor data, for Vehicle component
      if (fdata) {
        fdata.forEach(faultObj => {
          if (typeof faultObj.alert !== "undefined" &&
            typeof faultObj.alert.type !== "undefined" &&
            typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
            typeof faultObj.loc !== "undefined" &&
            Array.isArray(faultObj.loc) && faultObj.loc.length &&
            faultObj.occurredOnLatestIgnition &&
            (faultObj.alert.type === "Tire Pressure Fault" || faultObj.alert.type === "Tire Temperature Fault")
          ) {
            faultObj.loc.forEach(locObj => {

              // TPMS Pressure Alerts
              if (typeof locObj.vehComp !== "undefined" &&
                typeof cloneData[compId].tpmspress !== "undefined" &&
                faultObj.alert.type === "Tire Pressure Fault" &&
                locObj.vehComp === compId) {

                const locId = "tirepress_axle" + locObj.axle + "tire" + locObj.tire;
                if (typeof cloneData[compId].tpmspress[locId] !== "undefined") {
                  if (typeof cloneData[compId].tpmspress[locId].alert === "undefined" || (
                    typeof cloneData[compId].tpmspress[locId].alert !== "undefined" &&
                    faultObj.time > cloneData[compId].tpmspress[locId].alert.time)) {
                    cloneData[compId].tpmspress[locId].alert = {
                      time: faultObj.time,
                      class: "alert-" + faultObj.alert.color.toLowerCase(),
                      tooltip:
                        my.tr("alert_header") + ": " +
                        my.tr(faultObj.alert.trId) + " @" + my.app.convertUnixToTzHuman(faultObj.time) + " - "
                    };
                  }
                }
              }

              // TPMS Temperature Alerts
              if (typeof locObj.vehComp !== "undefined" &&
                typeof cloneData[compId].tpmstemp !== "undefined" &&
                faultObj.alert.type === "Tire Temperature Fault" &&
                locObj.vehComp === compId) {

                const locId = "tiretemp_axle" + locObj.axle + "tire" + locObj.tire;
                if (typeof cloneData[compId].tpmstemp[locId] !== "undefined") {
                  if (typeof cloneData[compId].tpmstemp[locId].alert === "undefined" || (
                    typeof cloneData[compId].tpmstemp[locId].alert !== "undefined" &&
                    faultObj.time > cloneData[compId].tpmstemp[locId].alert.time)) {
                    cloneData[compId].tpmstemp[locId].alert = {
                      time: faultObj.time,
                      class: "alert-" + faultObj.alert.color.toLowerCase(),
                      tooltip:
                        my.tr("alert_header") + ": " +
                        my.tr(faultObj.alert.trId) + " @" + my.app.convertUnixToTzHuman(faultObj.time) + " - "
                    };
                  }
                }
              }
            });
          }
        });
      }

      data[compId] = {};
      if (Object.keys(cloneData[compId].temptrac).length) {
        data.compIds.push(compId);
        data.foundTemptracSensors = true;
        data[compId].temptracHtml = me._genHtml(cloneData[compId].temptrac, isUpdate);
      }
      if (Object.keys(cloneData[compId].tpmstemp).length) {
        data.compIds.push(compId);
        data.foundTpmsTempSensors = true;
        data[compId].tpmsTempHtml = me._genHtml(cloneData[compId].tpmstemp, isUpdate);
      }
      if (Object.keys(cloneData[compId].tpmspress).length) {
        data.compIds.push(compId);
        data.foundTpmsPressSensors = true;
        data[compId].tpmsPressHtml = me._genHtml(cloneData[compId].tpmspress, isUpdate);
      }
    });

    // Remove duplicate component Ids
    data.compIds = [...new Set(data.compIds)];

    // Format the most recent timestamp, into human readable format
    // eg. Sa Aug 17, 2020 7:00 PM EDT
    data.lastReadTimestamp = my.app.convertUnixToTzHuman(me._lastReadTimestampUnix);

    return data;
  };

  /**
   * Detect whether Add-In panel is open / closed
   *
   *  @returns boolean
   */
  this.isPanelClosed = function () {
    const me = this;
    if (typeof me._panelElemObj !== "undefined" && me._panelElemObj) {
      return me._panelElemObj.classList.contains(me._panelClosedClass);
    }
    else {
      console.log("--- PANEL OPEN/CLOSE CHECK FAILED. Could not get handle on Panel Object within iframe Parent DOM",);
    }
  };

  /**
   * Open sensor data panel in UI
   *
   *  @returns void
   */
  this.openPanel = function () {
    const me = this;
    const panelOpenBtnObj = me._panelOpenCloseBtnElemObj;

    if (me.isPanelClosed()) {
      if (typeof panelOpenBtnObj !== "undefined" && panelOpenBtnObj) {
        console.log("--- PANEL CLOSED...ATTEMPTING TO OPEN",);
        panelOpenBtnObj.click();
      }
      else {
        console.log("--- PANEL OPEN FAILED. Could not get handle on Panel button within iframe Parent DOM",);
      }
    }
  };

  /**
   * Widget for navigating to vehicles in Panel UI
   *
   *  @returns void
   */
  this.panelVehJumper = function () {
    const me = {
      _parent: this,

      _showAfterNumMenuItems: 2,

      _rootEl: null,
      _menu: null,

      _callbackHandlers: {},

      init: function () {
        const ui = me._parent;

        me._rootEl = ui._pnlJmprContainerElemObj;
        me._menu = ui._pnlJmprMenuObj;

        me.clear();

        // Remove stale state
        me._rootEl.classList.remove("open");

        // Set Title in user-defined Language
        const pnlJmprTitleObj = me._rootEl.querySelector("strong");
        pnlJmprTitleObj.innerHTML = my.tr("panel_veh_jump_widget_title");
      },

      show: function () {
        if (!me._rootEl.classList.contains("open")) {
          me._rootEl.classList.add("open");
        }
        me._rootEl.classList.remove("close");
      },

      hide: function () {
        if (!me._rootEl.classList.contains("close")) {
          me._rootEl.classList.add("close");
        }
        me._rootEl.classList.remove("open");
      },

      clear: function () {
        if (me.numMenuItems() && me.isVisible()) {
          me.hide();
          setTimeout(function () {
            me._rootEl.classList.remove("close");
            for (const menuItm of me._menu.querySelectorAll("div")) {
              const vehId = menuItm.getAttribute("data-veh-id");
              me.del(vehId);
            }
          }, 1000);
        }
        else {
          me._menu.innerHTML = "";
          me._rootEl.classList.remove("open");
          me._rootEl.classList.remove("close");
        }
      },

      clearMenuItemSelections: function () {
        for (const menuItm of me._menu.querySelectorAll("div")) {
          menuItm.classList.remove("active");
        }
      },

      isVisible: function () {
        return me._rootEl.classList.contains("open") ? true : false;
      },

      menuItemExists: function (vehId) {
        if (vehId) {
          const menuItm = me._menu.querySelector(`div[data-veh-id="${vehId}"]`);
          return menuItm ? true : false;
        }
        return false;
      },

      numMenuItems: function () {
        return me._menu.querySelectorAll("div").length;
      },

      add: function (vehId, vehName) {
        const ui = me._parent;

        if (vehId && vehName && !me.menuItemExists(vehId)) {
          const div = document.createElement("div");

          // Create Menu Item
          div.setAttribute("data-veh-id", vehId);
          div.setAttribute("data-veh-name", vehName);
          div.innerHTML = vehName;
          div.addEventListener("click", me.onClickHandler);

          // Add alphabetically by Vehicle Name
          if (!me.numMenuItems()) {
            me._menu.appendChild(div);
            me.selectMenuItem(vehId);
          }
          else {
            let insertLast = true;
            for (const menuItm of me._menu.querySelectorAll("div")) {
              menuItmVehName = menuItm.innerHTML;
              if (vehName.localeCompare(menuItmVehName) === -1) {
                menuItm.parentNode.insertBefore(div, menuItm);
                insertLast = false;
                break;
              }
            }
            if (insertLast) {
              me._menu.appendChild(div);
            }
          }

          // Invoke all possible callbacks for vehId
          if (typeof me._callbackHandlers[vehId] !== "undefined" &&
            me._callbackHandlers[vehId] !== null &&
            Array.isArray(me._callbackHandlers[vehId]) &&
            me._callbackHandlers[vehId].length) {
            for (const callback of me._callbackHandlers[vehId]) {
              callback();
            }
            delete me._callbackHandlers[vehId];
          }

          // Show UI
          if (me.numMenuItems() >= me._showAfterNumMenuItems && !me.isVisible()) {
            me.show();
          }
        }
      },

      del: function (vehId) {
        const ui = me._parent;
        if (vehId && me.menuItemExists(vehId)) {
          const menuItm = me._menu.querySelector(`div[data-veh-id="${vehId}"]`);
          if (menuItm) {
            menuItm.remove();
          }

          // Hide UI, if less than minimum #veh's
          if (me.numMenuItems() < me._showAfterNumMenuItems && me.isVisible()) {
            me.hide();
          }
        }
      },

      selectMenuItem: function (vehId) {
        const ui = me._parent;
        if (vehId && me.menuItemExists(vehId)) {
          me.clearMenuItemSelections();

          const menuItm = me._menu.querySelector(`div[data-veh-id="${vehId}"]`);
          if (menuItm && !menuItm.classList.contains("active")) {
            menuItm.classList.add("active");
          }
        }
      },

      getVehNameFromId: function (vehId) {
        const ui = me._parent;
        if (vehId && me.menuItemExists(vehId)) {
          const menuItm = me._menu.querySelector(`div[data-veh-id="${vehId}"]`);
          if (menuItm) {
            return menuItm.getAttribute("data-veh-name");
          }
        }
      },

      registerWhenVehAdded: function (vehId, callback) {
        const ui = me._parent;

        if (vehId && callback && typeof callback === "function") {
          if (me.menuItemExists(vehId)) {
            callback();
          }
          else {
            if (typeof me._callbackHandlers[vehId] === "undefined") {
              me._callbackHandlers[vehId] = [];
            }
            me._callbackHandlers[vehId].push(callback);
          }
        }
      },

      onClickHandler: function (evt) {
        const ui = me._parent;
        const evtObj = typeof evt !== "string" && evt && typeof evt.target !== "undefined" ? evt.target : "";
        const vehId = evtObj ? evtObj.getAttribute("data-veh-id") : evt;
        const vehName = evtObj ? evtObj.innerHTML : me.getVehNameFromId(vehId);

        if (vehId && vehName) {
          const vehPanelId = my.vehPanelContentIdPrefix + vehId;
          const vehPanelObj = document.getElementById(vehPanelId);
          if (vehPanelObj) {
            vehPanelObj.scrollIntoView({ behavior: "smooth" });
          }
          me.selectMenuItem(vehId);
        }
      },
    };
    return me;
  }.bind(this)();

  /**
   * Task / Service for updating the UI for data from cache
   *
   *  @returns void
   */
  this.updateService = function () {
    const me = {
      _parent: this,

      _setIntervalHandle: null,
      _servicePollTime: my.uiUpdatePollingTime * 1000,     // Poll Time to wait before performing UI UPDATE operation

      start: function () {
        if (me._setIntervalHandle === null) {
          console.log("--- updateService() STARTED");
          me._setIntervalHandle = setInterval(me._doUpdate, me._servicePollTime);
        }
      },

      stop: function () {
        if (me._setIntervalHandle !== null) {
          console.log("--- updateService() STOPPED");
          clearInterval(me._setIntervalHandle);
          me._setIntervalHandle = null;
        }
      },

      isRunning: function () {
        return me._setIntervalHandle !== null ? true : false;
      },

      _doUpdate: function () {
        const vehReg = my.storage.sensorData.vehRegistry;
        const ui = me._parent;

        // Invoke per-Vehicle updates via API, when cached sensor data has expired
        for (const vehId in my.storage.sensorData.cache) {
          if (!my.storage.sensorData.cache[vehId].searching) {
            const vehName = my.app.getWatchlistVehNameByIds(vehId);
            my.app.getCachedSensorDataStatusForVeh(vehId, vehName);
          }
        }

        // Update Vehicle SensorData Panel
        my.app.monitorVehSensorDataStatus("updateServiceMode");

        // Update Tooltip (if Open)
        if (vehReg.tooltip && typeof my.storage.sensorData.cache[vehReg.tooltip] !== "undefined") {
          const vehId = vehReg.tooltip;
          const vehName = my.storage.sensorData.cache[vehId].data.vehName;
          ui.showTooltip(vehId, vehName);
        }
      },
    };
    return me;
  }.bind(this)();

  this._getComponentContentHtml = function (compId, showHeader, data) {
    const me = this;
    const my = me._my;
    const firstComponentHeaderClass = compId === data.compIds[0] ? "first" : "";
    const headerTitle = showHeader ? my.tr(my.vehComponents.toTr[compId]) : "";
    const compHeaderHtml = headerTitle ? me._getContent("component-header", {
      "firstComponentHeaderClass": firstComponentHeaderClass,
      "headerTitle": headerTitle
    }) : "";

    let compContentHtml = "";
    if (data.foundTemptracSensors) {
      compContentHtml += me._getContent("temptrac-content", {
        "contentHtml":
          typeof data[compId].temptracHtml !== "undefined" ?
            data[compId].temptracHtml : "&nbsp;"
      });
    }
    if (data.foundTpmsTempSensors || data.foundTpmsPressSensors) {
      if (data.foundTpmsTempSensors) {
        compContentHtml += me._getContent("tpms-content-temp", {
          "contentHtml":
            typeof data[compId].tpmsTempHtml !== "undefined" ?
              data[compId].tpmsTempHtml : "&nbsp;"
        });
      }
      if (data.foundTpmsPressSensors) {
        compContentHtml += me._getContent("tpms-content-press", {
          "contentHtml":
            typeof data[compId].tpmsPressHtml !== "undefined" ?
              data[compId].tpmsPressHtml : "&nbsp;"
        });
      }
    }

    return me._getContent("component-content", {
      "compHeaderHtml": compHeaderHtml,
      "compContentHtml": compContentHtml
    });
  };

  this._getContent = function (section, content) {
    const me = this;
    const my = me._my;

    switch (section) {
      case "dom-loader-widget":
        return "<img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' onload='initOnDomLoad();this.parentNode && this.parentNode.removeChild(this);'>";
        break;

      case "close-button-html":
        const closeBtnLabelTxt = my.tr("panel_btn_close_title");
        return `<button class="vehDetailClose" data-veh-id="${content.vehId}" aria-label="${closeBtnLabelTxt}" data-microtip-position="right" role="tooltip">X</button>`;
        break;

      case "skeleton-info-error-html":
        return `
            <div class="SplGeotabMapWrapper">
              <div class="splTableRow">
                  <div class="splTableCell title">
                      <label class="info"></label>
                      <strong class="error"></strong>
                  </div>
              </div>
            </div>
            `;
        break;

      case "skeleton-vehicle-sensor-data-html":
        return "";
        break;

      case "skeleton-header":
        return `
            <div class="SplGeotabMapWrapper" id="${content.vehPanelContentId}" data-veh-id="${content.vehId}">
              <div class="splTableRow">
                  <div class="splTableCell title">
                      <label${content.titleClassHtml}>${content.titleHtml}</label>
                      <strong>${content.vehNameHtml}</strong>
                      <div>${content.vehSpeedHtml}</div>
                  </div>
              </div>
              <div>${content.sensorDataHtml}</div>
            </div>
            `;
        break;

      case "skeleton-body":
        const SplToolsSwitchTitle = my.tr("panel_switchto_spltools_instruction");
        const LastReadingTitle = my.tr("panel_last_reading");
        const closeBtnLabel = my.tr("panel_btn_close_title");
        return `
            <button class="vehDetailClose" data-veh-id="${content.vehId}" aria-label="${closeBtnLabel}" data-microtip-position="right" role="tooltip">X</button>
            <div class="splTable">
                <div class="splTableRow pointer" aria-label="${SplToolsSwitchTitle}" data-microtip-position="bottom" role="tooltip" onclick="navigateToSplTools('${content.vehId}','${content.vehName}')">
                    ${content.headerTopHtml}
                </div>
                <div class="splTableRow">
                    ${content.headerHtml}
                </div>
                    ${content.contentHtml}
                <div class="splTableRow footer">
                    <div class="splTableCell"><label>${LastReadingTitle}:</label>${content.lastReadTimestamp}</div>
                </div>
            </div>
            `;
        break;

      case "component-header":
        return `
            <div class="splTableRow">
                <div class="splTableCell component-header ${content.firstComponentHeaderClass}">
                    ${content.headerTitle}
                </div>
            </div>
            `;
        break;

      case "component-content":
        return `
            ${content.compHeaderHtml}
            <div class="splTableRow">
                ${content.compContentHtml}
            </div>
            `;
        break;

      case "temptrac-header-top":
        return `
            <div class="splTableCell header header-top temptrac"><div class="button-badge">TEMPTRAC</div></div>
            `;
        break;

      case "temptrac-header":
        return `
            <div class="splTableCell header temptrac">Temp</div>
            `;
        break;

      case "temptrac-content":
        return `
            <div class="splTableCell temptrac content-table">
                <div class="content-body">
                    ${content.contentHtml}
                </div>
            </div>
            `;
        break;

      case "tpms-header-top":
        return `
            <div class="splTableCell header header-top tpms"><div class="button-badge">TPMS</div></div>
            `;
        break;

      case "tpms-header-temp":
        return `
            <div class="splTableCell header">Temp</div>
            `;
        break;

      case "tpms-header-press":
        return `
            <div class="splTableCell header">Press</div>
            `;
        break;

      case "tpms-content-temp":
      case "tpms-content-press":
        return `
            <div class="splTableCell content-table">
                <div class="content-body">
                    ${content.contentHtml}
                </div>
            </div>
            `;
        break;
    }
  };

  /**
   * Generate HTML fragment for each Sensor Data Record
   *
   *  @returns string
   */
  this._genHtml = function (sdata, isUpdate) {
    const me = this;
    const my = me._my;
    const keysSorted = Object.keys(sdata).sort();
    const sensorTimeTitle = my.tr("panel_sensor_timestamp");
    let outHtml = "";

    // eslint-disable-next-line complexity
    keysSorted.forEach(function (loc) {
      if (sdata.hasOwnProperty(loc)) {
        const locObj = sdata[loc];
        const sensorTime = my.app.convertUnixToTzHuman(locObj.time);
        const alertClass = typeof locObj.alert !== "undefined" && typeof locObj.alert.class !== "undefined" ? locObj.alert.class : "";
        const alertTooltip = typeof locObj.alert !== "undefined" && typeof locObj.alert.tooltip !== "undefined" ? locObj.alert.tooltip : "";

        // Keep track of the most recent sensor data timestamp
        if (locObj.time > me._lastReadTimestampUnix) {
          me._lastReadTimestampUnix = locObj.time;
        }

        // Animate the sensor record under following State conditions:
        //       State = |   Initial Data    | New Data | Stale Data | Search but no Data Found | New Data Found |
        // -------------------------------------------------------------------------------------------------------
        //    IsUpdate = |   FALSE    | TRUE                                                                     |
        // -------------------------------------------------------------------------------------------------------
        // LOC-OBJ.NEW = |     UNDEFINED     |   TRUE   |    FALSE   |            NULL          |      FALSE     |
        //               |     UNDEFINED                |    FALSE   |                                           |
        // -------------------------------------------------------------------------------------------------------
        //        Glow = | FLASH-ONCE |  NO  | STAY-ON  |     NO     |          STAY-ON         |       NO       |
        // -------------------------------------------------------------------------------------------------------
        const glowStayOn = (isUpdate === true && typeof locObj.new !== "undefined" && (locObj.new === true || locObj.new === null) ? true : false);
        let animationClassName = " glow-" +
          (locObj.type === "Temptrac" ?
            (glowStayOn ? "stay-on-" : "") + "temptrac" :
            (glowStayOn ? "stay-on-" : "") + "tpms"
          );
        if ((typeof locObj.new !== "undefined" && locObj.new === false) ||
          (isUpdate === true && typeof locObj.new === "undefined")) {
          animationClassName = "";
        }

        // Process Temptrac Record
        if (locObj.type === "Temptrac") {
          const locHtml = me._convertLocToShortName(locObj.zone);
          outHtml += `
            <div class="sensor-timestamp${animationClassName}" aria-label="${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" role="tooltip">
              <div class="val-loc">${locHtml}</div>
              <div class="val-temp">${locObj.val.c}<span>&#8451;</span><p>${locObj.val.f}<span>&#8457;</span></p></div>
            </div>`;
        }
        // Process TPMS-Temperature Record
        else if (locObj.type === "Tire Temperature") {
          const locHtml = me._convertLocToShortName(locObj.axle);
          outHtml += `
            <div class="sensor-timestamp${animationClassName}" aria-label="${alertTooltip}${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" role="tooltip">
              <div class="val-loc ${alertClass}">${locHtml}</div>
              <div class="val-temp">${locObj.val.c}<span>&#8451;</span><p>${locObj.val.f}<span>&#8457;</span></p></div>
            </div>`;
        }
        // Process TPMS-Pressure Record
        else if (locObj.type === "Tire Pressure") {
          const locHtml = me._convertLocToShortName(locObj.axle);
          outHtml += `
            <div class="sensor-timestamp${animationClassName}" aria-label="${alertTooltip}${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" role="tooltip">
              <div class="val-loc ${alertClass}">${locHtml}</div>
              <div class="val-pres">${locObj.val.psi}<span>Psi</span><p>${locObj.val.kpa}<span>kPa</span></p><p>${locObj.val.bar}<span>Bar</span></p></div>
            </div>`;
        }
      }
    });
    return outHtml;
  };

  /**
  * Convert Location Title/Label to ShortName equivelant
  * eg. "Axle 1 Tire 2" => "A1-T2"
  *
  *  @returns string
  */
  this._convertLocToShortName = function (locLabel) {
    if (locLabel) {
      return locLabel.indexOf("one") > -1 ?
        locLabel :
        locLabel
          .replace("Axle ", "A")
          .replace("Tire ", "T")
          .replace(" ", "-");
    }
    return "";
  };

  this.configure = function (my, rootDomObj, containerId, panelLabelId, panelTiteBoldId, panelBtnId, panelId, panelClass, pnlJmprContainerId, pnlJmprMenuId) {
    const me = this;
    me._my = my;
    me._rootElemObj = rootDomObj;
    me._containerElemObj = me._rootElemObj.querySelector(containerId);
    me._panelOpenCloseBtnElemObj = parent.document.querySelector(panelBtnId);
    me._panelElemObj = parent.document.querySelector(panelId);
    me._pnlJmprContainerElemObj = me._rootElemObj.querySelector(pnlJmprContainerId);
    me._pnlJmprMenuObj = me._rootElemObj.querySelector(pnlJmprMenuId);
    me._panelClosedClass = panelClass;

    // The panel selector Ids could change by Geotab without warning, so test and report if broken
    if (typeof me._panelOpenCloseBtnElemObj === "undefined" || me._panelOpenCloseBtnElemObj === null) {
      console.log("--- Could not get handle on Add-In Panel Open/Close button within iframe Parent DOM...update Selector",);
    }
    if (typeof me._panelElemObj === "undefined" || me._panelElemObj === null) {
      console.log("--- Could not get handle on Add-In Panel Container Element within iframe Parent DOM...update Selector",);
    }

    // Use Ids to dynamically create reference to respective Dom objects on Dom Load
    me._panelLabelId = panelLabelId;
    me._panelTitleBoldId = panelTiteBoldId;
  };

  // configure when an instance gets created
  this.configure(my, rootDomObj, containerId, panelLabelId, panelTiteBoldId, panelBtnId, panelId, panelClass, pnlJmprContainerId, pnlJmprMenuId);
};

/**********************************************************************************
 *  SpartanLync Logo / Watermark component
 * - Shows SplTools User Settings and App metadata
 */
const InitLogoUI = function (my, rootDomObj, containerId) {
  /**
   *  Private Variables
   */

  this._my = null;
  this._rootElemObj = null;
  this._containerElemObj = null;

  this._buildVersion = null;
  this._buildDate = null;

  this._labelAppName = "about_appname";
  this._labelTimezone = "about_timezone";
  this._labelRefresh = "about_refresh";
  this._labelLang = "about_lang";
  this._labelBuildVer = "about_buildver";
  this._labelBuildDate = "about_builddate";
  this._settingsChangeMsg = "about_instruction";
  this._unknownValue = "";

  this.init = function () {
    const me = this;
    const my = me._my;
    me._unknownValue = my.tr("about_unknown");
    me.refresh();
  };

  this.refresh = function () {
    const me = this;
    const my = me._my;
    const rootEl = me._containerElemObj;
    const timeZone = my.storage.splStore.timezone;
    const refreshRate = my.storage.splStore.sensorInfoRefreshRate;
    let language = me._unknownValue;

    // Fetch Language from SplTools configuration
    if (typeof my.storage.splStore.lang !== "undefined" && my.storage.splStore.lang) {
      language = my.supportedLanguages[my.storage.splStore.lang];
    }

    me._fetchBuildInfo((build) => {
      rootEl.innerHTML = me._renderHTML({
        "timeZone": timeZone ? timeZone : me._unknownValue,
        "refreshRate": refreshRate ? (refreshRate / 60) + " min" : me._unknownValue,
        "language": language,
        "buildVer": build.ver,
        "buildDate": build.date,
      });
    });
  };

  this._renderHTML = function (prop) {
    const me = this;
    const my = me._my;
    const content = me._getContentObj(prop);
    return `
    <div>
      <label>${content.appName}</label>
      <div>
        <strong>${content.labelTimezone}:</strong>
        <span>${content.contentTimezone}</span>
        <strong>${content.labelRefresh}:</strong>
        <span>${content.contentRefresh}</span>
        <strong>${content.labelLang}:</strong>
        <span>${content.contentLang}</span>
        <p>${content.settingsChangeMsg}</p>
        <strong>${content.labelBuildVer}:</strong>
        <span>${content.contentBuildVer}</span>
        <strong>${content.labelBuildDate}:</strong>
        <span>${content.contentBuildDate}</span>
      </div>
    </div>
    `;
  };

  this._getContentObj = function (prop) {
    const me = this;
    const my = me._my;
    return {
      "appName": my.tr(me._labelAppName),
      "labelTimezone": my.tr(me._labelTimezone),
      "labelRefresh": my.tr(me._labelRefresh),
      "labelLang": my.tr(me._labelLang),
      "labelBuildVer": my.tr(me._labelBuildVer),
      "labelBuildDate": my.tr(me._labelBuildDate),
      "settingsChangeMsg": my.tr(me._settingsChangeMsg),

      "contentTimezone": prop.timeZone,
      "contentRefresh": prop.refreshRate,
      "contentLang": prop.language,
      "contentBuildVer": prop.buildVer,
      "contentBuildDate": prop.buildDate,
    };
  };

  this._fetchBuildInfo = function (callback) {
    const me = this;
    const my = me._my;
    const addInName = my.addInJSONName;
    const buildMetaFilename = my.addInBuildMetadataFilename;

    if (me._buildVersion === null || me._buildDate === null) {
      my.service.api.call("Get", {
        typeName: "SystemSettings"
      }).then(([settings]) => {
        const addInJson = JSON.parse(settings.customerPages.filter((jsonTxt) => {
          return jsonTxt.indexOf(`"name":"${addInName}"`) > -1;
        }).join(""));
        const addInDeploymentUrl = addInJson.items[0].mapScript.url.split("/").slice(0, -1).join("/");
        const buildMetaUrl = addInDeploymentUrl + "/" + buildMetaFilename;

        fetch(buildMetaUrl)
          .then(response => response.text())
          .then((metadataTxt) => {
            const [appVer, unixTimestamp] = metadataTxt.trim().split("\n");
            if (appVer && !isNaN(unixTimestamp)) {
              me._buildVersion = appVer;
              me._buildDate = my.app.convertUnixToTzHuman(unixTimestamp);
              callback({
                "ver": me._buildVersion,
                "date": me._buildDate,
              });
            }
          })
          .catch(err => {
            me._buildVersion = me._unknownValue;
            me._buildDate = me._unknownValue;
            callback({
              "ver": me._buildVersion,
              "date": me._buildDate,
            });
          });
      });
    }
    else {
      callback({
        "ver": me._buildVersion,
        "date": me._buildDate,
      });
    }
  };

  this.configure = function (my, rootDomObj, containerId) {
    const me = this;
    me._my = my;
    me._rootElemObj = rootDomObj;
    me._containerElemObj = me._rootElemObj.querySelector(containerId);

    //DEBUG
    me._containerElemObj.addEventListener("click", () => {
      const dataBak = JSON.parse(JSON.stringify(my.storage));
      delete dataBak.credentials;
      console.log(JSON.stringify(dataBak));
      console.log("==== UPDATE SERVICE TASK", my.ui.updateService.isRunning() ? "IS" : "IS NOT", "RUNNING");
    });
  };

  // configure when an instance gets created
  this.configure(my, rootDomObj, containerId);
};