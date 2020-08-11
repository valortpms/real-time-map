/* eslint-disable no-unused-vars */

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

    rootEl.innerHTML = me.getContent("skeleton-header");
  };

  this.getContent = function (section, content) {
    const me = this;
    const my = me._my;

    switch (section) {
      case "skeleton-header":
        return `
            <div class="splTableRow">
                <div class="splTableCell title">
                    <label>SpartanLync Sensors For:</label>
                    <strong></strong>
                    <div></div>
                </div>
            </div>
            <div id="SplGeotabMapSensorData"></div>
            <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' onload='initOnDomLoad();this.parentNode.removeChild(this);'>
            `;
        break;

      case "skeleton-body":
        return `
            <div class="splTable">
                <div class="splTableRow pointer" aria-label="View In SpartanLync Tools" data-microtip-position="bottom" role="tooltip" onclick="navigateToSplTools('${content.vehId}','${content.vehName}')">
                    ${content.headerTopHtml}
                </div>
                <div class="splTableRow">
                    ${content.headerHtml}
                </div>
                    ${content.contentHtml}
                <div class="splTableRow footer">
                    <div class="splTableCell"><label>Last Reading:</label>${content.lastReadTimestamp}</div>
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
        tipCfg.main = my.toolTipSettings.sensorsSearchingMsg;
        break;

      case "BUSY-NEW":
      case "FOUND":
        tipCfg.main = my.toolTipSettings.sensorsFoundMsg;
        tipCfg.secondary = my.app.fetchSensorTypes(vehId);
        tipCfg.additional = [my.toolTipSettings.sensorsFoundMenuItemMsg];
        break;

      case "NOTFOUND":
        tipCfg.main = my.toolTipSettings.sensorsNotFoundMsg;
        break;
    }

    // Update UI
    my.service.tooltip.show(tipCfg, 0);
  };

  this.showMenuItem = function (vehId, vehName, vehSpeed) {
    const me = this;
    const my = me._my;
    const vehSpeedHTML = vehSpeed ? vehSpeed + " km/h" : "";
    console.log("--- showMenuItem() vehId = ", vehId, " vehName = ", vehName, " vehSpeed = ", vehSpeed); //DEBUG

    // Register Event
    my.storage.sensorData.vehRegistry.menuItem = vehId;

    // Update UI
    me.renderHTML(vehId, vehName, vehSpeed, my.app.getCachedSensorDataStatusForVeh(vehId, vehName));

    // Invoke Panel Update Task
  };

  this.renderHTML = function (vehId, vehName, vehSpeed, contentStatus) {
    const me = this;
    const my = me._my;
    const labelEl = me._panelLabelObj;
    const contentEl = me._contentElemObj;
    const vehNameEl = me._vehNameObj;
    const vehSpeedEl = me._vehSpeedObj;
    let htmlOutput = "";

    // Generate Panel HTML content based on content status
    // Status:
    //    "BUSY"     - Searching for NEW data
    //    "BUSY-NEW" - Searching for NEW data, But STALE data found
    //    "NOTFOUND" - No Sensors Found
    //    "FOUND"    - Found Sensor data
    //
    switch (contentStatus) {
      case "BUSY":
        me.showMsg(my.menuItemSettings.sensorsSearchingMsg.replace("{veh}", vehName));
        break;

      case "BUSY-NEW":
      case "FOUND":
        htmlOutput += me.getContent("skeleton-body", {
          vehId: vehId,
          vehName: vehName,
          headerTopHtml: "headerTopHtml",
          headerHtml: "headerHtml",
          contentHtml: "contentHtml",
          lastReadTimestamp: moment().format(my.timeFormat),
        });

        me.clearMsgState();
        labelEl.innerHTML = "SpartanLync Sensors For:";
        vehNameEl.innerHTML = vehName;
        vehSpeedEl.innerHTML = vehSpeed ? vehSpeed + " km/h" : "";
        contentEl.innerHTML = htmlOutput;
        break;

      case "NOTFOUND":
        me.showMsg(my.menuItemSettings.sensorsNotFoundMsg.replace("{veh}", vehName));
        break;
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
    console.log("SplGeotabMap Error: " + msg.replace(/\<br \/\>/g, " "));
    errorEl.innerHTML = `Error:<br />${msg}`;
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
    console.log("--- UI INIT DONE"); //DEBUG
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
