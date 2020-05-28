import React, { Component } from "react";
import { deviceSearch } from "./vehicle-search";

export class VehicleToggleButtons extends React.Component {
   constructor(props) {
      super(props);
      this.state = { visibility: true };
      this.toggleVisibility = this.toggleVisibility.bind(this);
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
               className={`toggleButton ${
                  this.state.visibility ? "shown" : "notShown"
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
