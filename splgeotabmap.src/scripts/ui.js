/* eslint-disable no-unused-vars */

/**********************************************************************************
 *  App UI Lib
 */
const InitOutputUI = function (my, rootDomObj, containerId, sensorContentId, panelLabelId, vehNameId, vehSpeedId) {
  /**
   *  Private Variables
   */

  this._my = null;
  this._callback = null;
  this._rootElemObj = null;
  this._containerElemObj = null;

  this._contentElemId = "";
  this._contentElemObj = null;
  this._panelLabelId = "";
  this._panelLabelObj = null;
  this._vehNameId = "";
  this._vehNameObj = null;
  this._vehSpeedId = "";
  this._vehSpeedObj = null;

  this._lastReadTimestampUnix = 0;

  this.init = function (callback) {
    const me = this;
    const my = me._my;

    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    // Init Handlers
    window.initOnDomLoad = me.onDomLoad.bind(this);

    // Update UI
    me.clear();
  };

  this.clear = function (callback) {
    const me = this;
    const my = me._my;
    const rootEl = me._containerElemObj;

    me._callback = callback && typeof callback === "function" ? callback : me._callback !== null ? me._callback : null;

    rootEl.innerHTML = me._getContent("skeleton-header");
  };

  // Update Lib with reference to dynamically loaded Elements
  this.onDomLoad = function () {
    const me = this;

    me._contentElemObj = me._containerElemObj.querySelector(me._contentElemId);
    me._panelLabelObj = me._containerElemObj.querySelector(me._panelLabelId);
    me._vehNameObj = me._containerElemObj.querySelector(me._vehNameId);
    me._vehSpeedObj = me._containerElemObj.querySelector(me._vehSpeedId);

    // Invoke callback if provided
    if (me._callback) {
      me._callback();
      me._callback = null;
    }
  };

  this.showMsg = function (msg) {
    const me = this;
    const labelEl = me._panelLabelObj;

    me.clearMsgState();
    if (!labelEl.classList.contains("info")) {
      labelEl.classList.add("info");
    }
    labelEl.innerHTML = msg;
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
        tipCfg.main = my.tr("sensors_tooltip_found_msg");
        tipCfg.secondary = my.app.fetchSensorTypes(vehId);
        tipCfg.additional = [my.tr("sensors_tooltip_found_menuitem_msg")];
        break;

      case "NOTFOUND":
        tipCfg.main = my.tr("sensors_tooltip_not_found_msg");
        break;
    }

    // Update UI
    my.service.tooltip.show(tipCfg, 0);
  };

  this.showMenuItem = function (vehId, vehName, vehSpeed) {
    const me = this;
    const my = me._my;

    // Register Event
    my.storage.sensorData.vehRegistry.menuItem = vehId;

    // Update UI
    me.renderMenuItemHTML(vehId, vehName, vehSpeed, my.app.getCachedSensorDataStatusForVeh(vehId, vehName));

    // Invoke UI Tooltip / Panel Update Task
    my.ui.updateService.start();

    // Save Panel change immediately
    my.localStore.save("NOW");
  };

  this.showError = function (msg) {
    const me = this;
    const errorEl = me._vehNameObj;
    const labelEl = me._panelLabelObj;

    // Add error class then error message
    if (!errorEl.classList.contains("error")) {
      errorEl.classList.add("error");
    }
    if (!labelEl.classList.contains("hidden")) {
      labelEl.classList.add("hidden");
    }
    console.log(my.tr("error_app_title") + ": " + msg.replace(/\<br \/\>/g, " "));
    errorEl.innerHTML = my.tr("error_title") + ":<br />" + msg;
  };

  this.clearMsgState = function () {
    const me = this;
    const errorEl = me._vehNameObj;
    const labelEl = me._panelLabelObj;
    const contentEl = me._contentElemObj;

    // Remove error class then any content in element
    if (errorEl.classList.contains("error")) {
      errorEl.classList.remove("error");
    }
    if (labelEl.classList.contains("info")) {
      labelEl.classList.remove("info");
    }
    if (labelEl.classList.contains("hidden")) {
      labelEl.classList.remove("hidden");
    }
    errorEl.innerHTML = "";
    contentEl.innerHTML = "";
  };

  this.renderMenuItemHTML = function (vehId, vehName, vehSpeed, contentStatus) {
    const me = this;
    const my = me._my;
    const labelEl = me._panelLabelObj;
    const contentEl = me._contentElemObj;
    const vehNameEl = me._vehNameObj;
    const vehSpeedEl = me._vehSpeedObj;

    // Generate Panel HTML content based on content status
    // Status:
    //    "BUSY"     - Searching for NEW data
    //    "BUSY-NEW" - Searching for NEW data, But STALE data found
    //    "NOTFOUND" - No Sensors Found
    //    "FOUND"    - Found Sensor data
    //
    switch (contentStatus) {
      case "BUSY":
        me.showMsg(my.tr("sensors_menuitm_searching_msg").replace("{veh}", vehName));
        break;

      case "BUSY-NEW":
      case "FOUND":
        me.clearMsgState();
        labelEl.innerHTML = my.tr("panel_title");
        vehNameEl.innerHTML = vehName;
        vehSpeedEl.innerHTML = vehSpeed ? vehSpeed + " km/h" : "";
        contentEl.innerHTML = me.getHtmlFromSensorData(vehId, vehName);
        break;

      case "NOTFOUND":
        me.showMsg(my.tr("sensors_menuitm_not_Found_msg").replace("{veh}", vehName));
        break;
    }
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
    const compIds = sdata.vehCfg.total === 1 ? [sdata.vehCfg.active] : sdata.vehCfg.ids;
    const vehSearchCfg = my.storage.sensorData.cache[sdata.vehId];
    const isUpdate = !vehSearchCfg.firstTime;
    const data = {
      compIds: [],
      vehId: sdata.vehId,
      vehName: sdata.vehName,
      lastReadTimestamp: ""
    };
    me._lastReadTimestampUnix = 0;

    // Process Single/Multi-Component source sensor data
    data.foundTemptracSensors = false;
    data.foundTpmsTempSensors = false;
    data.foundTpmsPressSensors = false;
    compIds.map(compId => {
      data[compId] = {};
      if (Object.keys(sdata[compId].temptrac).length) {
        data.compIds.push(compId);
        data.foundTemptracSensors = true;
        data[compId].temptracHtml = me._genHtml(sdata[compId].temptrac, isUpdate);
      }
      if (Object.keys(sdata[compId].tpmstemp).length) {
        data.compIds.push(compId);
        data.foundTpmsTempSensors = true;
        data[compId].tpmsTempHtml = me._genHtml(sdata[compId].tpmstemp, isUpdate);
      }
      if (Object.keys(sdata[compId].tpmspress).length) {
        data.compIds.push(compId);
        data.foundTpmsPressSensors = true;
        data[compId].tpmsPressHtml = me._genHtml(sdata[compId].tpmspress, isUpdate);
      }
    });

    // Remove duplicate component Ids
    data.compIds = [...new Set(data.compIds)];

    // Format the most recent timestamp, into human readable format
    // eg. Sa Aug 17, 2020 7:00 PM EDT
    data.lastReadTimestamp = my.app.convertUnixToTzHuman(me._lastReadTimestampUnix);

    return data;
  };

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
      case "skeleton-header":
        return `
            <div class="splTableRow">
                <div class="splTableCell title">
                    <label></label>
                    <strong></strong>
                    <div></div>
                </div>
            </div>
            <div id="SplGeotabMapSensorData"></div>
            <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' onload='initOnDomLoad();this.parentNode.removeChild(this);'>
            `;
        break;

      case "skeleton-body":
        const SplToolsSwitchTitle = my.tr("panel_switchto_spltools_instruction");
        const LastReadingTitle = my.tr("panel_last_reading");
        return `
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
            <div class="sensor-timestamp${animationClassName}" aria-label="${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" data-microtip-size="medium" --microtip-font-size="12px" role="tooltip">
              <div class="val-loc">${locHtml}</div>
              <div class="val-temp">${locObj.val.c}<span>&#8451;</span><p>${locObj.val.f}<span>&#8457;</span></p></div>
            </div>`;
        }
        // Process TPMS-Temperature Record
        else if (locObj.type === "Tire Temperature") {
          const locHtml = me._convertLocToShortName(locObj.axle);
          outHtml += `
            <div class="sensor-timestamp${animationClassName}" aria-label="${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" data-microtip-size="medium" --microtip-font-size="12px" role="tooltip">
              <div class="val-loc">${locHtml}</div>
              <div class="val-temp">${locObj.val.c}<span>&#8451;</span><p>${locObj.val.f}<span>&#8457;</span></p></div>
            </div>`;
        }
        // Process TPMS-Pressure Record
        else if (locObj.type === "Tire Pressure") {
          const locHtml = me._convertLocToShortName(locObj.axle);
          outHtml += `
            <div class="sensor-timestamp${animationClassName}" aria-label="${sensorTimeTitle}: ${sensorTime}" data-microtip-position="top" data-microtip-size="medium" --microtip-font-size="12px" role="tooltip">
              <div class="val-loc">${locHtml}</div>
              <div class="val-pres">${locObj.val.psi}<span>Psi</span><p>${locObj.val.kpa}<span>kPa</span></p><p>${locObj.val.bar}<span>Bar</span></p></div>
            </div>`;
        }
      }
    });
    return outHtml;
  };

  /**
   * Task / Service for updating the UI for data from cache
   *
   *  @returns string
   */
  this.updateService = function () {
    const me = {
      _parent: this,

      _setIntervalHandle: null,
      _servicePollTime: my.uiUpdatePollingTime * 1000,     // Poll Time to wait before performing UI UPDATE operation

      start: function () {
        if (me._setIntervalHandle === null) {
          console.log("--- updateService() STARTED");//DEBUG
          me._setIntervalHandle = setInterval(me._doUpdate, me._servicePollTime);
        }
      },

      stop: function () {
        if (me._setIntervalHandle !== null) {
          console.log("--- updateService() STOPPED");//DEBUG
          clearInterval(me._setIntervalHandle);
          me._setIntervalHandle = null;
        }
      },

      _doUpdate: function () {
        const vehReg = my.storage.sensorData.vehRegistry;
        const ui = me._parent;

        // Invoke per-Vehicle updates via API, when cached sensor data has expired
        for (const vehId in my.storage.sensorData.cache) {
          if (!my.storage.sensorData.cache[vehId].searching) {
            const vehName = my.storage.sensorData.cache[vehId].data.vehName;
            my.app.getCachedSensorDataStatusForVeh(vehId, vehName);
          }
        }

        // Update MenuItem Panel
        if (vehReg.menuItem && typeof my.storage.sensorData.cache[vehReg.menuItem] !== "undefined" &&
            typeof my.storage.sensorData.cache[vehReg.menuItem].data.vehName !== "undefined") {
          const vehId = vehReg.menuItem;
          const vehName = my.storage.sensorData.cache[vehId].data.vehName;
          my.service.api.call("Get", {
            typeName: "DeviceStatusInfo",
            search: { deviceSearch: { id: vehId } }
          }).then(([dsi]) => {
            const vehSpeed = dsi.speed;
            ui.renderMenuItemHTML(vehId, vehName, vehSpeed, my.app.getCachedSensorDataStatusForVeh(vehId, vehName));
          });
        }

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

  this.configure = function (my, rootDomObj, containerId, sensorContentId, panelLabelId, vehNameId, vehSpeedId) {
    const me = this;
    me._my = my;
    me._rootElemObj = rootDomObj;
    me._containerElemObj = me._rootElemObj.querySelector(containerId);

    // Use Ids to dynamically create reference to respective Dom objects on page load
    me._contentElemId = sensorContentId;
    me._panelLabelId = panelLabelId;
    me._vehNameId = vehNameId;
    me._vehSpeedId = vehSpeedId;
  };

  // configure when an instance gets created
  this.configure(my, rootDomObj, containerId, sensorContentId, panelLabelId, vehNameId, vehSpeedId);
};

/**********************************************************************************
 *  SpartanLync Logo / Watermark Lib
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

  this._labelAppName      = "about_appname";
  this._labelTimezone     = "about_timezone";
  this._labelRefresh      = "about_refresh";
  this._labelLang         = "about_lang";
  this._labelBuildVer     = "about_buildver";
  this._labelBuildDate    = "about_builddate";
  this._settingsChangeMsg = "about_instruction";

  this.init = function () {
    const me = this;
    const my = me._my;
    me.refresh();
  };

  this.refresh = function () {
    const me = this;
    const my = me._my;
    const rootEl = me._containerElemObj;
    const timeZone = my.storage.splStore.timezone;
    const refreshRate = my.storage.splStore.sensorInfoRefreshRate;
    let language = "UnKnown";

    // Fetch Language from SplTools configuration
    if (typeof my.storage.splStore.lang !== "undefined" && my.storage.splStore.lang) {
      language = my.supportedLanguages.filter((langObj) => {
        return langObj.code === my.storage.splStore.lang;
      })[0].label;
    }

    me._fetchBuildInfo((build) => {
      rootEl.innerHTML = me._renderHTML({
        "timeZone":     timeZone ? timeZone : "UnKnown",
        "refreshRate":  refreshRate ? (refreshRate / 60) + " min" : "UnKnown",
        "language":     language,
        "buildVer":     build.ver,
        "buildDate":    build.date,
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
        <strong>${content.labelBuildVer}:</strong>
        <span>${content.contentBuildDate}</span>
      </div>
    </div>
    `;
  };

  this._getContentObj = function (prop) {
    const me = this;
    const my = me._my;
    return {
      "appName":            my.tr(me._labelAppName),
      "labelTimezone":      my.tr(me._labelTimezone),
      "labelRefresh":       my.tr(me._labelRefresh),
      "labelLang":          my.tr(me._labelLang),
      "labelBuildVer":      my.tr(me._labelBuildVer),
      "labelBuildDate":     my.tr(me._labelBuildDate),
      "settingsChangeMsg":  my.tr(me._settingsChangeMsg),

      "contentTimezone":    prop.timeZone,
      "contentRefresh":     prop.refreshRate,
      "contentLang":        prop.language,
      "contentBuildVer":    prop.buildVer,
      "contentBuildDate":   prop.buildDate,
    };
  };

  this._fetchBuildInfo = function (callback) {
    const me = this;
    const my = me._my;
    const addInName = my.addInJSONName;
    const buildMetaFilename = my.addInBuildMetadataFilename;

    if(me._buildVersion === null || me._buildDate === null) {
      my.service.api.call("Get", {
        typeName: "SystemSettings"
      }).then(([settings]) => {
        const addInJson = JSON.parse(settings.customerPages.filter((jsonTxt) => {
          return jsonTxt.indexOf(`"name":"${addInName}"`) > -1;
        }).join(""));
        const addInDeploymentUrl = addInJson.items[0].mapScript.url.split("/").slice(0,-1).join("/");
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
          me._buildVersion = "UnKnown";
          me._buildDate = "UnKnown";
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
    console.log(JSON.stringify(my.storage)); //DEBUG
  });
};

// configure when an instance gets created
this.configure(my, rootDomObj, containerId);
};