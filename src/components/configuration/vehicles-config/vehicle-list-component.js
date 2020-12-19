import React, { Component } from "react";
import splSrv from "../../../spartanlync/services";
import { deviceSearch } from "./vehicle-search";
import { SplSensorDataTypesButton } from "../../../spartanlync/components/ui-vehicles-config";
import { markerList } from "../../../dataStore/map-data";
import splSrvTools from "../../../spartanlync/services/tools";

export const VehicleListComponent = (props) => {
   if (props && props.vehicleDisplayList && !props.vehicleDisplayList.length) {
      return [];
   }
   // Sort by Vehicle Name
   props.vehicleDisplayList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

   const mapPropsToComponent = props.setVehicleDisplay;
   const vehicleList =
      props.vehicleDisplayList.length > 0
         ? props.vehicleDisplayList.map(prop => (
            <li key={prop.id} className="spl-list-item">
               <span
                  className={`RTM-iconSquare mdc-list-item__graphic material-icons filterIcon ${prop.visible ? "showConfig" : "hideConfig"
                     }`}
                  data-tip="Hide/Show Vehicle on Map"
                  data-for="splTooltip"
                  onClick={() =>
                     deviceSearch.toggleDeviceVisibility(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <CreateDeviceListElement
                  id={prop.id}
                  name={prop.name}
                  color={prop.color}
                  flyFunction={deviceSearch.zoomIntoDevice}
               />
               <span
                  id={"RTMnode-" + prop.id}
                  data-veh-id={prop.id}
                  className={`RTM-ConfigListItem mdc-list-item__text ${prop.alertClass ? prop.alertClass : ""}`}
                  {...(prop.tooltip && {
                     "data-tip": "<div class='spl-vehicle-alert-tooltip'>" + prop.tooltip + "</div>",
                     "data-for": "splTooltip"
                  })}>
                  {prop.name}
               </span>
               <span
                  className="mdc-list-item__meta material-icons"
                  data-tip="Remove this Vehicle from Panel"
                  data-for="splTooltip"
                  onClick={() =>
                     deviceSearch.deleteItemFromdeviceList(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <SplSensorDataTypesButton id={prop.id} name={prop.name} />
               <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' className="loader" onLoad={splSrvTools.trOnElementLoad.vehicle}></img>
            </li>
         ))
         : [];
   return vehicleList;
};

/**
 *  Vehicle List Item Element in Vehicle configuation Panel
 *
 *  @returns JSX object
 */
export class CreateDeviceListElement extends Component {

   constructor(props) {
      super(props);

      this.vehId = this.props.id;
      this.vehName = this.props.name.trim();
      this.color = typeof this.props.color !== "undefined" ? this.props.color : null;
      this.flyFunction = typeof this.props.flyFunction === "function" ? this.props.flyFunction : null;

      this.MINIMUM_GPS_POINTS_FOR_VEH_FLYING = 2;

      this.latLngCounter = 0;
      this.latLngEventHandlerId = null;
      this.dateChangeEventHandlerId = null;

      this.state = {
         isGroup: this.props.name.includes("Group") ? true : false,
         isVehActive: false,
      };

      this.searchForVehMapGPS = this.searchForVehMapGPS.bind(this);
   }

   /**
    * On Component Load
    *
    *  @returns void
    */
   componentDidMount() {
      const me = this;

      // eslint-disable-next-line no-unused-vars
      me.latLngEventHandlerId = splSrv.events.register("onNewVehLatLng", (vehId, latLng) => { // "latLng" provided but not used at this time
         if (vehId === me.vehId) {
            me.latLngCounter++;
            if (me.latLngCounter >= me.MINIMUM_GPS_POINTS_FOR_VEH_FLYING && !this.state.isVehActive) {
               me.setState({ isVehActive: true });
            }
         }
      }, false);

      // On Date Change, reset vehicle status
      me.dateChangeEventHandlerId = splSrv.events.register("onMapDateChangeResetReOpenPopups", () => {
         me.latLngCounter = 0;
         me.setState({ isVehActive: false });
      }, false);

      me.searchForVehMapGPS();
   }
   componentWillUnmount() {
      const me = this;
      splSrv.events.delete("onNewVehLatLng", me.latLngEventHandlerId);
      splSrv.events.delete("onMapDateChangeResetReOpenPopups", me.dateChangeEventHandlerId);
      me.latLngEventHandlerId = null;
      me.dateChangeEventHandlerId = null;
   }

   /**
    * Does vehicle already exists on Map with valid GPS
    *
    *  @returns void
    */
   searchForVehMapGPS() {
      const me = this;
      const deviceMarker = markerList[me.vehId];
      if (deviceMarker && typeof deviceMarker.currentlatLng !== "undefined") {
         me.latLngCounter = me.MINIMUM_GPS_POINTS_FOR_VEH_FLYING;
         me.setState({ isVehActive: true });
      }
   }

   render() {
      const me = this;
      const vehActiveClass = me.state.isVehActive ? "active" : "";

      if (me.state.isGroup) {
         const { r, g, b, a } = me.color;
         const backgroundColorStyleValue = me.color ? `rgba(${r},${g},${b},${a})` : "";
         return (
            <span
               className="mdc-list-item__graphic material-icons group"
               style={{ backgroundColor: backgroundColorStyleValue ? backgroundColorStyleValue : null }}
            ></span>
         );
      }
      else {
         return (
            <span
               className={`mdc-list-item__graphic material-icons vehicle ${vehActiveClass}`}
               data-tip="Fly to Vehicle on Map"
               data-for="splTooltip"
               onClick={() => me.flyFunction(me.vehId)}
            ></span>
         );
      }
   };
};
