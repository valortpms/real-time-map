import React, { Component } from "react";
import { deviceSearch } from "./vehicle-search";
import { SplSensorDataTypesButton } from "../../../spartanlync/components/ui-vehicles-config";
import storage from "../../../dataStore";
import splSrv from "../../../spartanlync/services";

export const VehicleListComponent = props => {
   const mapPropsToComponent = props.setVehicleDisplay;
   const vehicleList =
      props.vehicleDisplayList.length > 0
         ? props.vehicleDisplayList.map(prop => (
            <li key={prop.id} className="spl-list-item">
               <span
                  className={`RTM-iconSquare mdc-list-item__graphic material-icons filterIcon ${
                     prop.visible ? "showConfig" : "hideConfig"
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
               {createDeviceListElement(
                  prop.id,
                  prop.name,
                  prop.color,
                  deviceSearch.zoomIntoDevice
               )}
               <span
                  id={"RTMnode-" + prop.id}
                  className="RTM-ConfigListItem mdc-list-item__text"
               >
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
               <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' className="loader" onLoad={splSrv.trOnElementLoad.vehicle}></img>
            </li>
         ))
         : [];
   return vehicleList;
};

const createDeviceListElement = (id, name, color, flyFunction) => {
   if (name.includes("Group")) {
      const { r, g, b, a } = color;
      const rgba = `rgba(${r},${g},${b},${a})`;
      return (
         <span
            className="mdc-list-item__graphic material-icons group"
            style={{ backgroundColor: rgba }}
         ></span>
      );
   } else {
      return (
         <span
            className="mdc-list-item__graphic material-icons vehicle"
            data-tip="Fly to Vehicle on Map"
            data-for="splTooltip"
            onClick={() => {
               storage.map.closePopup();
               flyFunction(id);
            }}
         ></span>
      );
   }
};
