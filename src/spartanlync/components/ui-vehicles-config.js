// eslint-disable-next-line no-unused-vars
import React, { Component, Fragment } from "react";
import ReactTooltip from "react-tooltip";
import splSrv from "../services";
import splCfg from "../config";
import { INITSplSensorDataTools, splSensorDataParser } from "../services/sensor-data-tools";
import { fetchVehSensorDataAsync, fetchVehFaultsAndIgnitionAsync } from "../services/api/temptrac-tpms/utils";
import { liveButtonModel } from "../../components/controls/live-button-model/live-button-model";

/**
 * Renders a SpartanLync Sensor Data Button / Content window
 * meant to insert into a Vehicle List Item within Vehicle Configuration Panel
 *
 *  @returns JSX object
 */
export class SplSensorDataTypesButton extends Component {

   constructor(props) {
      super(props);

      this.init = this.init.bind(this);
      this.onClickHandler = this.onClickHandler.bind(this);
      this.renderSplButton = this.renderSplButton.bind(this);
      this.onCloseContentHandler = this.onCloseContentHandler.bind(this);
      this.locExistsInSensorData = this.locExistsInSensorData.bind(this);
      this.configureSensorDataTypesBtn = this.configureSensorDataTypesBtn.bind(this);

      this.state = {
         components: [],
         buttons: [],
         html: "",
         loading: false
      };

      this.vehId = this.props.id;
      this.vehName = this.props.name.trim();
      this.faultAlertEventHandlerId = null;
      this.dateTimeChangedEventHandlerId = null;
      this.sdataCache = null;

      this.noSensorsFoundOnThisVehicle = false;

      this.goLib = null;
      this.sdataTools = null;
      this.contentRefreshTimerHandle = null;
      this.faultMonitoringTimerHandle = null;
   }

   componentDidMount() {
      const me = this;

      // Notify Listeners on Addition of Vehicle to Map
      splSrv.events.exec("onVehConfigPanelLoad", me.vehId);

      // Register as a new instance in Veh configuration panel
      splSrv.vehRegistry.loadingBegin(me.vehId, me);

      // Prevent duplicate Initial Invocation(s)
      splCfg.shouldSplSensorDataButtonUpdate = false;
      setTimeout(() => {
         splCfg.shouldSplSensorDataButtonUpdate = true;
      }, 50);

      // Initialize if SpartanLync Services is Loaded
      if (splSrv._splToolsInstalled) {
         me.init();
      }
      // Otherwise Defer
      else {
         splSrv.events.register("onLoadSplServices", me.init);
      }
   }
   componentWillUnmount() {
      const me = this;
      me.onCloseContentHandler();
   }

   /**
    * Init by
    * 1. Creating ASync instance of Geotab sensor data Lib
    * 2. Fetching sensor data types installed on a vehicle
    *
    *  @returns void
    */
   init() {
      const me = this;

      // Init SpartanLync sensor data searches in Veh Config Panel
      me.sdataTools = new INITSplSensorDataTools(splSrv.goLibCreatorFunc);
      me.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);
      me.sdataTools.setSensorDataNotFoundMsg(splSrv.sensorDataNotFoundMsg);
      me.sdataTools.setVehComponents(splSrv.vehCompTr.toEn);

      // Set Language-specific sensor data search messages
      me.sdataTools.setSensorSearchInProgressResponseMsg(splmap.tr("sensor_search_busy_msg"));

      // Fetch SpartanLync Sensor Types installed into vehicle
      me.fetchSensorTypesAndFaults();
   }

   // eslint-disable-next-line no-unused-vars
   shouldComponentUpdate(nextProps, nextState) {
      // Handler for preventing duplicate Initial Invocation(s)
      return splCfg.shouldSplSensorDataButtonUpdate;
   }

   /**
    * Fetch vehicle fault + ignition data from API
    * Parse results and store in cache for initiating alerts
    *
    *  @returns void
    */
   fetchFaultsAndIgnitionData() {
      const me = this;
      const overrideFirstTimeCall = splSrv.cache.getFaultData(me.vehId) === null ? null : false;

      //Splunk for fault & ignition data for specific vehicle
      fetchVehFaultsAndIgnitionAsync(me.vehId, overrideFirstTimeCall)
         .then(([faults, vehIgnitionInfo]) => {
            const faultsFoundPriorToUpdate = splSrv.cache.isFaultFound(splSrv.cache.getFaultData(me.vehId));

            // Update Fault & Ignition data caches
            splSrv.cache.storeFaultData(me.vehId, faults);
            splSrv.cache.storeIgnData(me.vehId, vehIgnitionInfo);

            // Update Faults cache with new ignition data
            if (typeof vehIgnitionInfo !== "undefined" && vehIgnitionInfo !== null &&
               typeof vehIgnitionInfo === "object" && typeof vehIgnitionInfo["on-latest"] !== "undefined" &&
               vehIgnitionInfo["on-latest"]) {
               splSrv.cache.updateFaultStatusUsingIgnData(me.vehId);
            }

            // Invoke New Fault event handlers by throwing a New-Fault Event
            splSrv.vehRegistry.loadingEnd(me.vehId);
            if (splSrv.cache.isFaultFound(faults) || faultsFoundPriorToUpdate !== splSrv.cache.isFaultFound(faults)) {
               splSrv.events.exec("onFaultAlert", me.vehId, me);
            }
         })
         .catch((reason) =>
            console.log("---- Error while searching for FAULTS on VehicleID [ " + me.vehId + " ] named [ " + me.vehName + " ]: ", reason));
   }

   /**
    * Fetch vehicle sensor data from API
    * Parse results and update state on sensor types & components of vehicle
    *
    *  @returns void
    */
   fetchSensorTypesAndFaults() {
      const me = this;

      //Splunk for presence of sensor data types & vehicle components
      fetchVehSensorDataAsync(me.vehId)
         .then((sdata) => {

            // Save Sensor data for SensorDataTypesButton configuration and later filtering of alerts
            me.sdataCache = sdata;

            me.configureSensorDataTypesBtn();
         })
         .catch((reason) => {
            if (reason === splSrv.sensorDataNotFoundMsg) {
               console.log("---- NO SENSORS FOUND for VehicleID [ " + me.vehId + " ] named [ " + me.vehName + " ]");
               me.noSensorsFoundOnThisVehicle = true;
            }
         })
         .finally(() => {
            if (!me.noSensorsFoundOnThisVehicle) {

               // Start fault update timer
               me.startFaultAndTypesBtnMonitorTask();

               // Fetch vehicle faults and ignition data for Alert cache(s)
               me.fetchFaultsAndIgnitionData();
            }
         });
   }

   /**
    * Update SensorDataTypesButton state based on current Sensor Data
    *
    *  @returns void
    */
   configureSensorDataTypesBtn() {
      const me = this;
      const btn = [];

      if (me.sdataCache) {
         if (typeof me.sdataCache.vehCfg.ids !== "undefined" && Array.isArray(me.sdataCache.vehCfg.ids)) {
            const stypes = [];
            me.sdataCache.vehCfg.ids.forEach(function (comp) {
               const compSdata = me.sdataCache.vehCfg.compsdata[comp];
               if (Object.keys(compSdata.temptrac).length) {
                  stypes.push("temptrac");
               }
               if (Object.keys(compSdata.tpmspress).length || Object.keys(compSdata.tpmstemp).length) {
                  stypes.push("tpms");
               }
            });
            if (stypes.includes("temptrac")) {
               btn.push("temptrac");
            }
            if (stypes.includes("tpms")) {
               btn.push("tpms");
            }
         }
         else {
            if (Object.keys(me.sdataCache.temptrac).length) {
               btn.push("temptrac");
            }
            if (Object.keys(me.sdataCache.tpmspress).length || Object.keys(me.sdataCache.tpmstemp).length) {
               btn.push("tpms");
            }
         }
         const vehCompNames = me.sdataCache.vehCfg.ids.map(compId => { return splSrv.vehCompDb.names[compId]; }).join(", ");
         const btnNames = btn.join(", ");

         console.log("Sensor data for VehicleID [", me.vehId, "] reports Sensor Types [", btnNames, "] on", me.sdataCache.vehCfg.ids.length, "component" + (me.sdataCache.vehCfg.ids.length > 1 ? "s" : ""), "[", vehCompNames, "]");
         if (btn.length !== me.state.buttons.length || me.sdataCache.vehCfg.ids.length !== me.state.components.length) {
            me.setState({
               components: me.sdataCache.vehCfg.ids.length > 1 ? me.sdataCache.vehCfg.ids : [],
               buttons: btn
            });
         }
      }
   }


   /**
    * Check for existence of sensor location object in cahced sensor data
    * Return TRUE if found, otherwise FALSE if not found or error
    *
    *  @returns boolean
    */
   locExistsInSensorData(locType, locObj) {
      const me = this;
      if (!locType || !locObj) {
         return false;
      }
      const sdataType = locType === "Tire Temperature Fault" ? "tpmstemp" : "tpmspress";
      const locId = (locType === "Tire Temperature Fault" ? "tiretemp_axle" : "tirepress_axle") + locObj.axle + "tire" + locObj.tire;

      if (me.sdataCache && typeof me.sdataCache.vehCfg !== "undefined" && typeof me.sdataCache.vehCfg.compsdata !== "undefined" &&
         typeof locObj.vehComp !== "undefined" && locObj.vehComp && typeof me.sdataCache.vehCfg.compsdata[locObj.vehComp] !== "undefined") {
         const sdata = me.sdataCache.vehCfg.compsdata[locObj.vehComp];
         for (const sdataLocId in sdata[sdataType]) {
            const sdataLocObj = sdata[sdataType][sdataLocId];
            if (sdataLocObj.id === locId) {
               return true;
            }
         }
      }
      return false;
   }

   /**
    * Click Handler, invoked once there are sensor types to display
    *
    *  @returns void
    */
   onClickHandler() {
      const me = this;
      let splHtmlOut = "";

      if (manageSensorDataContentUI.register(me.vehId, me.onCloseContentHandler)) {

         // Set the Loading Page
         me.setState({
            html: "<strong class='loading'>" + splmap.tr("sensor_search_busy_getting_data_msg") + "</strong>",
            loading: true
         });

         // Splunk for sensor data
         me.sdataTools.resetCache(me.vehId);
         me.sdataTools.fetchCachedSensorData(me.vehId, me.vehName)
            .then(sensorData => {
               splHtmlOut = splSensorDataParser.generateSensorDataHtml(sensorData, me.vehId, me.sdataTools);

               // Start sensor data update task
               me.startContentRefresh();
            })
            .catch(reason => {
               splHtmlOut = me.renderSplSensorSearchErrorHtml(reason);
            })
            .finally(() => {
               if (manageSensorDataContentUI.confirmed(me.vehId)) {

                  // IF LIVE,
                  // Register Handler for showing timely possible changes to vehicle sensor data content,
                  // instead of waiting for the sensor data update task
                  me.faultAlertEventHandlerId = splSrv.events.register("onFaultAlert", (vehId) => {
                     if (vehId === me.vehId && !liveButtonModel.getToDateOverride()) {
                        setTimeout(() => {
                           me.updateSensorDataContent(); // After a 1 second delay, refresh sensor data content using new fault data
                        }, 1000);
                     }
                  }, false);

                  // On a Date/Time change
                  // Flush vehicle cache and fetch new sensor data
                  me.dateTimeChangedEventHandlerId = splSrv.events.register("onDateTimeChanged", () => {
                     me.sdataTools.resetCache(me.vehId);
                     setTimeout(() => {
                        me.updateSensorDataContent(); // After a 1 second delay, refresh sensor data content using new date/time
                     }, 500);
                  }, false);

                  // Render UI
                  me.setState({
                     html: splHtmlOut,
                     loading: false
                  });
               }
            });
      }
   }

   /**
    * Close Handler, invoked once UI is closed
    *
    *  @returns void
    */
   onCloseContentHandler() {
      const me = this;
      manageSensorDataContentUI.cleanup(me.vehId);
      me.stopContentRefresh();
      me.stopFaultAndTypesBtnMonitorTask();
      me.setState({ html: "" });
      splSrv.vehRegistry.close(me.vehId);

      if (me.faultAlertEventHandlerId) {
         splSrv.events.delete("onFaultAlert", me.faultAlertEventHandlerId);
      }
      me.faultAlertEventHandlerId = null;

      if (me.dateTimeChangedEventHandlerId) {
         splSrv.events.delete("onDateTimeChanged", me.dateTimeChangedEventHandlerId);
      }
      me.dateTimeChangedEventHandlerId = null;
   }

   /**
    * Update sensor data content
    *
    *  @returns void
    */
   updateSensorDataContent() {
      const me = this;
      let splHtmlOut = "";
      me.sdataTools.fetchCachedSensorData(me.vehId, me.vehName)
         .then((sensorData) => {
            splHtmlOut = splSensorDataParser.generateSensorDataHtml(sensorData, me.vehId, me.sdataTools);
         })
         .catch((reason) => {
            splHtmlOut = me.renderSplSensorSearchErrorHtml(reason);
            setTimeout(() => {
               // on Error, close content UI after a short time for user to read the error
               me.onCloseContentHandler();
            }, (splSrv.onErrorCloseUIDelay * 1000));
         })
         .finally(() => {
            if (splHtmlOut) {
               me.setState({
                  html: splHtmlOut
               });
            }
         });
   }

   /**
    * Start/Stop vehicle sensor data content update task
    *
    *  @returns void
    */
   startContentRefresh() {
      const me = this;
      if (me.contentRefreshTimerHandle === null) {
         me.contentRefreshTimerHandle = setInterval(
            () => me.updateSensorDataContent(),
            (splSrv.sensorDataLifetime * 1000)
         );
      }
   }
   stopContentRefresh() {
      const me = this;
      if (me.contentRefreshTimerHandlel) {
         clearInterval(me.contentRefreshTimerHandle);
      }
      me.contentRefreshTimerHandle = null;
   }

   /**
    * Start/Stop vehicle fault monitoring task
    *
    *  @returns void
    */
   startFaultAndTypesBtnMonitorTask() {
      const me = this;
      if (me.faultMonitoringTimerHandle === null) {
         me.faultMonitoringTimerHandle = setInterval(
            () => {
               // Poll for vehicle fault changes
               me.fetchFaultsAndIgnitionData();

               // Poll for SensorDataTypesButton changes
               fetchVehSensorDataAsync(me.vehId, "", false)
                  .then((sdata) => {
                     me.sdataCache = sdata;
                     me.configureSensorDataTypesBtn();
                  })
                  .catch((reason) => {
                     if (reason === splSrv.sensorDataNotFoundMsg) {
                        console.log("Sensor Data for VehicleID [ " + me.vehId + " ] named [ " + me.vehName + " ] reports NO SENSORS for this time range");
                     }
                  });
            }, (splSrv.sensorDataLifetime * 1000));
      }
   }
   stopFaultAndTypesBtnMonitorTask() {
      const me = this;
      if (me.faultMonitoringTimerHandle) {
         clearInterval(me.faultMonitoringTimerHandle);
      }
      me.faultMonitoringTimerHandle = null;
   }

   /**
    * Renders Temptrac or TPMS button for UI
    *
    *  @returns JSX
    */
   renderSplButton(type) {
      return (
         <div className={`spl-vehcfg-sensor-data-button-item ${type}`} key={type}>
            {type === "temptrac" ? "TempTrac" : "TPMS"}
         </div>
      );
   }

   /**
    * Renders Sensor Data Search Error HTML for UI
    *
    *  @returns HTML
    */
   renderSplSensorSearchErrorHtml(errorReason) {
      const getToDateOverride = liveButtonModel.getToDateOverride();
      const timeWarpClass = getToDateOverride ? "time-warp" : "";
      const timeWarpLabelHtml = getToDateOverride ? "<span>" + splmap.tr("sensor_search_back_in_time") + "</span>" : "";
      return `<p class="SPL-popupSensor veh-config error ${timeWarpClass}">${errorReason}${timeWarpLabelHtml} </p>`;
   }

   render() {
      const me = this;
      const sensorContentWrapperClass = me.state.html ? (me.state.loading ? "loading" : "") : "hidden";
      const sensorContentBtnCloseClass = me.state.loading ? "hidden" : "";
      const sensorBtnWrapperClass = me.state.buttons.length && me.state.html ? "hidden" : "";
      const sensorBtnComponentsClass = me.state.components.length && me.state.buttons.length ?
         (me.state.buttons.length > 1 ?
            "both-sensors" : "") : "hidden";
      const sensorBtnHandleClass = me.state.buttons.length ?
         (me.state.buttons.length > 1 ?
            "both-sensors" : "") : "hidden";
      const vehicleComponentsTitle = splmap.tr("splmap_vehpanel_component_title");
      const viewSensorDataTooltip = splmap.tr("splmap_vehpanel_splsensors_btn_tooltip");

      if (me.state.buttons.length) {
         setTimeout(() => {
            ReactTooltip.rebuild();
         }, 1000);
      }
      return (
         <Fragment>
            <span
               className={`spl-vehcfg-sensor-data-btn-wrapper ${sensorBtnWrapperClass}`}
               {...(me.state.buttons.length && {
                  "onClick": me.onClickHandler,
                  "data-tip": viewSensorDataTooltip,
                  "data-for": "splTooltip"
               })}>
               <div className="spl-vehcfg-sensor-data-button">
                  {me.state.buttons.length ? me.state.buttons.map(type => me.renderSplButton(type)) : ""}
               </div>
               <span className={`btn-handle ${sensorBtnHandleClass}`}></span>
               <div className={`btn-components ${sensorBtnComponentsClass}`}
                  {...(me.state.components.length && {
                     "data-tip":
                        "<div class='veh-components-popup'><span>" + vehicleComponentsTitle + "</span>" +
                        me.state.components.map(component => "<li>" + splmap.tr(splSrv.vehCompTr.toTr[component]) + "</li>").join("") +
                        "</div>",
                     "data-for": "splTooltip"
                  })}>
                  {me.state.components.length ? me.state.components.length : ""}
               </div>
            </span >
            <div className={`btn-content-wrapper ${sensorContentWrapperClass}`}>
               <button className={`btn-content-close ${sensorContentBtnCloseClass}`} onClick={me.onCloseContentHandler}>×</button>
               <div className="btn-content" dangerouslySetInnerHTML={{ __html: me.state.html }}></div>
            </div>
         </Fragment>
      );
   }
};

/**
 *  Manage which SplSensorDataTypesButton sibling is showing Sensor Data in UI
 */
export const manageSensorDataContentUI = {

   _settings: {
      veh: null,
      confirmed: false,
      closeHandler: null
   },

   /**
    * Register button that wants to invoke content in UI
    *
    *  @returns boolean TRUE - Registration successful, now waiting for confirmation
    *                   FALSE - Registration failed, BUSY with another registration
    */
   register: function (vehId, closeFuncHandler) {
      const me = this;

      if (typeof closeFuncHandler !== "function") {
         return false;
      }
      if (me._settings.veh === null) {
         me._settings.veh = vehId;
         me._settings.confirmed = false;
         me._settings.closeHandler = closeFuncHandler;
         return true;
      }
      else if (me._settings.veh === vehId) {
         return false;
      }
      else {
         if (me._settings.confirmed) {
            const oldFunc = me._settings.closeHandler;
            me._settings.veh = vehId;
            me._settings.confirmed = false;
            me._settings.closeHandler = closeFuncHandler;
            oldFunc();
            return true;
         }
         else {
            return false;
         }
      }
   },

   /**
    * Confirmed Registration, Resource now in use, but allowing override by another registration
    * Must provide the same vehId as Registration
    *
    *  @returns boolean TRUE - Confirmation successful, allowing another registration
    *                   FALSE - Wrong VehId supplied for confirmation
    */
   confirmed: function (vehId) {
      const me = this;
      if (me._settings.veh === vehId) {
         me._settings.confirmed = true;
         return true;
      }
      return false;
   },

   /**
    * Cleanup / Close registration as all popup are now closed
    *
    *  @returns void
    */
   cleanup: function (vehId) {
      const me = this;
      if (me._settings.veh === vehId) {
         me._settings.veh = null;
         me._settings.confirmed = false;
         me._settings.closeHandler = null;
      }
   },
   close: function () {
      const me = this;
      if (typeof me._settings.closeHandler === "function") {
         me._settings.closeHandler();
      }
   }
};