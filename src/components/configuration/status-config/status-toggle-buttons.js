import React, { Component } from "react";
import { diagnosticSearch } from "./status-search";

export class StatusToggleButtons extends React.Component {
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
               id="toggleStatus"
               className={`toggleButton ${
                  this.state.visibility ? "shown" : "notShown"
                  }`}
               data-tip="Toggle All Statuses"
               data-for="splTooltip"
               onClick={() => {
                  this.toggleVisibility();
                  if (this.state.visibility) {
                     diagnosticSearch.hideAllItems(this.props.setStatusDisplay);
                  } else {
                     diagnosticSearch.showAllItems(this.props.setStatusDisplay);
                  }
               }}
            ></button>
            <button
               id="deleteStatus"
               className="deleteButton"
               data-tip="Delete All Statuses"
               data-for="splTooltip"
               onClick={() =>
                  diagnosticSearch.deleteAllItems(this.props.setStatusDisplay)
               }
            ></button>
         </>
      );
   }
}
