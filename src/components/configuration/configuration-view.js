import React, { Component } from "react";
import { ExceptionsTab } from "./exception-config/exceptions-tab";
import { StatusTab } from "./status-config/status-tab";
import { VehiclesTab } from "./vehicles-config/vehicles-tab";
import { initCollapse } from "./utils/config-collapse";
import { diagnosticSearch } from "./status-config/status-search";
import { exceptionSearch } from "./exception-config/exception-search";
import { deviceSearch } from "./vehicles-config/vehicle-search";
import { splSensorDataParser } from "../../spartanlync/services/sensor-data-tools";
import { markerList } from "../../dataStore/map-data";
import storage from "../../dataStore";
import splSrv from "../../spartanlync/services";

export class ConfigView extends React.Component {
   constructor(props) {
      super(props);
      this.state = {
         exceptionsSearchList: [],
         statuses: [],
         devices: [],
         exceptionDisplayList: [],
         statusDisplayList: [],
         vehicleDisplayList: []
      };
      this.setExceptions = this.setExceptions.bind(this);
      this.setExceptionsList = this.setExceptionsList.bind(this);
      this.setStatusList = this.setStatusList.bind(this);
      this.setVehicleList = this.setVehicleList.bind(this);
      this.setStatuses = this.setStatuses.bind(this);
      this.setDevices = this.setDevices.bind(this);
   }

   setExceptions(props) {
      this.setState({ exceptionsSearchList: props });
   }

   setExceptionsList(props) {
      this.setState({ exceptionDisplayList: props });
   }

   setStatusList(props) {
      this.setState({ statusDisplayList: props });
   }

   setVehicleList(props) {
      this.setState({ vehicleDisplayList: props });

      // Register Handler for showing changes to Vehicle Alert Status
      this.setState((state) => {
         let vehicleFaultAlertEventHandlerId = typeof state.vehicleFaultAlertEventHandlerId === "undefined" ? null : state.vehicleFaultAlertEventHandlerId;
         if (!vehicleFaultAlertEventHandlerId &&
            typeof state.vehicleDisplayList !== "undefined" && state.vehicleDisplayList !== null &&
            Array.isArray(state.vehicleDisplayList) && state.vehicleDisplayList.length) {

            // eslint-disable-next-line complexity
            vehicleFaultAlertEventHandlerId = splSrv.events.register("onFaultAlert", (vehId, vehObj) => {
               const alertlevel = {
                  time: 0,
                  color: "",
                  tooltipHtml: ""
               };
               // Process Alerts
               for (const faultObj of splSrv.cache.getFaultData(vehId)) {
                  if (typeof faultObj.time !== "undefined" &&
                     typeof faultObj.alert !== "undefined" &&
                     typeof faultObj.alert.color !== "undefined" &&
                     typeof faultObj.alert.type !== "undefined" &&
                     typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
                     faultObj.occurredOnLatestIgnition &&
                     faultObj.time &&
                     faultObj.alert.type !== "Sensor Fault" &&
                     faultObj.alert.color.toString().trim() !== ""
                  ) {
                     // Remove Alerts with locations that do not exist
                     let skipFault = false;
                     if (typeof faultObj.loc !== "undefined" && Array.isArray(faultObj.loc) && faultObj.loc.length) {
                        faultObj.loc = faultObj.loc.filter((locObj) => {
                           return vehObj.locExistsInSensorData(faultObj.alert.type, locObj);
                        });
                        if (!faultObj.loc.length) {
                           skipFault = true;
                        }
                     }
                     if (skipFault) { continue; }

                     // Get most recent / urgent post-ignition fault level alert
                     if (!alertlevel.color ||
                        (alertlevel.color && alertlevel.color.toUpperCase() === "AMBER" && faultObj.alert.color.toUpperCase() === "RED") ||
                        (alertlevel.color.toUpperCase() === faultObj.alert.color.toUpperCase() && faultObj.time > alertlevel.time)) {

                        const sensorLocHtml = splSensorDataParser._convertLocArrObjToLocHtml(faultObj.loc);

                        alertlevel.time = faultObj.time;
                        alertlevel.color = faultObj.alert.color;
                        alertlevel.class = "strobe-" + faultObj.alert.color.toLowerCase();
                        alertlevel.alertSummary = splmap.tr("alert_header") + ": " + splmap.tr(faultObj.alert.trId);
                        alertlevel.tooltipHtml =
                           '<p class="spl-vehicle-alert-tooltip-header">' + splmap.tr("alert_header") + ":</p>" + splmap.tr(faultObj.alert.trId) + "<br />" +
                           (faultObj.alert.type === "Tire Pressure Fault" ? "( " + splmap.tr("alert_tire_pressure_fault") + " )<br />" : "") +
                           (faultObj.alert.type === "Tire Temperature Fault" ? "( " + splmap.tr("alert_temperature_over") + " )<br />" : "") +
                           "@" + splSrv.convertUnixToTzHuman(faultObj.time) +
                           (sensorLocHtml ? '<p class="spl-vehicle-alert-tooltip-location-header">' + splmap.tr("alert_sensor_location_header") + ":</p>" + sensorLocHtml : "");
                     }
                  }
               }

               // Update Alert status of Vehicle List on Vehicle Config Tab
               this.setState((state) => {
                  const vehDisplayList = state.vehicleDisplayList;
                  for (const idx in vehDisplayList) {
                     if (vehDisplayList[idx].id === vehId) {
                        // If alert for vehicle found, update vehicle AlertClass + Tooltip
                        if (alertlevel.color) {
                           vehDisplayList[idx].alertClass = alertlevel.class;
                           vehDisplayList[idx].tooltip = alertlevel.tooltipHtml;
                        }
                        // Otherwise, clear alert if one exists
                        else {
                           if (typeof vehDisplayList[idx].alertClass !== "undefined" && vehDisplayList[idx].alertClass) {
                              delete vehDisplayList[idx].alertClass;
                              delete vehDisplayList[idx].tooltip;
                           }
                        }
                     }
                  }
                  return { vehicleDisplayList: vehDisplayList };
               });

               // Update Vehicle Map Icon
               setTimeout(function () {
                  const vehMarkerObj = markerList[vehId];
                  if (typeof vehMarkerObj !== "undefined" && vehMarkerObj !== null &&
                     typeof vehMarkerObj === "object" && typeof vehMarkerObj.mapMarker !== "undefined"
                  ) {
                     const vehMapElem = vehMarkerObj.mapMarker.getElement();
                     if (vehMapElem) {
                        vehMapElem.classList.remove("strobe-amber");
                        vehMapElem.classList.remove("strobe-red");
                        if (alertlevel.color) {
                           vehMapElem.classList.add(alertlevel.class);

                           // On Vehicle Map tooltip, update Vehicle Storage Object with Alert info
                           console.log("--- Alert[" + vehId + "] SET on Map Tooltip"); //DEBUG
                           if (typeof storage.selectedDevices[vehId] !== "undefined") {
                              const devObj = storage.selectedDevices[vehId];
                              devObj.alert = alertlevel;
                           }
                        }
                        else {
                           // On Vehicle Map tooltip, Remove Alert info
                           if (typeof storage.selectedDevices[vehId] !== "undefined" &&
                              typeof storage.selectedDevices[vehId].alert !== "undefined") {
                              console.log("--- Alert[" + vehId + "] CLEARED on Map Tooltip"); //DEBUG
                              delete storage.selectedDevices[vehId].alert;
                           }
                        }
                     }
                  }
               }, 1000);

            }, false);
         }
         else {
            // Un-Register Handler for Vehicle Alert Status, if Vehicle list is EMPTY
            if (vehicleFaultAlertEventHandlerId &&
               typeof state.vehicleDisplayList !== "undefined" && state.vehicleDisplayList !== null &&
               Array.isArray(state.vehicleDisplayList) && !state.vehicleDisplayList.length) {
               splSrv.events.delete("onFaultAlert", vehicleFaultAlertEventHandlerId);
               vehicleFaultAlertEventHandlerId = null;
            }
         }
         return { vehicleFaultAlertEventHandlerId: vehicleFaultAlertEventHandlerId };
      });
   }

   setStatuses(props) {
      this.setState({ statuses: props });
   }

   setDevices(props) {
      this.setState({ devices: props });
   }

   componentDidMount() {
      deviceSearch.init(this.setDevices);
      diagnosticSearch.init(this.setStatuses);
      exceptionSearch.init(this.setExceptions);
      deviceSearch.loadSavedDeviceConfig(this.setVehicleList);
      diagnosticSearch.loadSavedStatusConfig(this.setStatusList);
      exceptionSearch.loadSavedExceptionConfig(this.setExceptionsList);
      initCollapse();
   }

   render() {
      return (
         <div id="RTM-config-view">
            <div id="RTM-config-container">
               <div id="RTM-config-header" className="">
                  <VehiclesTab
                     devices={this.state.devices}
                     vehicleDisplayList={this.state.vehicleDisplayList}
                     onClick={this.setVehicleList}
                  />
                  <StatusTab
                     statuses={this.state.statuses}
                     statusDisplayList={this.state.statusDisplayList}
                     onClick={this.setStatusList}
                  />
                  <ExceptionsTab
                     exceptions={this.state.exceptionsSearchList}
                     exceptionDisplayList={this.state.exceptionDisplayList}
                     onClick={this.setExceptionsList}
                  />
               </div>
            </div>
         </div>
      );
   }
}