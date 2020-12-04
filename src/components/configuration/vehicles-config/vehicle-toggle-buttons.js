import React, { Component } from "react";
import splSrv from "../../../spartanlync/services";
import { deviceSearch } from "./vehicle-search";

export class VehicleToggleButtons extends React.Component {
   constructor(props) {
      super(props);
      this.state = { visibility: true };
      this.toggleVisibility = this.toggleVisibility.bind(this);
   }

   componentDidMount() {
      const me = this;

      // On Map data Load, reset state of Show/HideAll button
      splSrv.events.register("onLoadMapDataCompleted", () => me.setToggleVisibility(), false);

      // On Device Search Save, set visibility of Show/HideAll button
      splSrv.events.register("onDeviceSearchSave", () => me.setToggleVisibility(), false);
   }

   setToggleVisibility() {
      const me = this;
      const visibleVehs = Object.values(deviceSearch.selectedIDS).filter(vehObj => { return vehObj.visible; });
      if (Object.keys(deviceSearch.selectedIDS).length && !visibleVehs.length) {
         me.setState({ visibility: false });
      }
      else {
         me.setState({ visibility: true });
      }
   }

   toggleVisibility() {
      this.setState(state => {
         return { visibility: !state.visibility };
      });
   }

   render() {
      return (
         <>
            <button
               id="clearDevices"
               className={`toggleButton ${this.state.visibility ? "shown" : "notShown"
                  }`}
               data-tip="Toggle All Vehicles/Groups"
               data-for="splTooltip"
               onClick={() => {
                  this.toggleVisibility();
                  if (this.state.visibility) {
                     deviceSearch.hideAll(this.props.setVehicleDisplay);
                  } else {
                     deviceSearch.showAll(this.props.setVehicleDisplay);
                  }
               }}
            ></button>
            <button
               id="deleteDevices"
               className="deleteButton"
               data-tip="Remove All Vehicles/Groups from Panel"
               data-for="splTooltip"
               onClick={() =>
                  deviceSearch.deleteAllItems(this.props.setVehicleDisplay)
               }
            ></button>
         </>
      );
   }
}
