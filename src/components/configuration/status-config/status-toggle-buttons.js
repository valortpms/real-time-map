import React, { Component } from "react";
import splSrv from "../../../spartanlync/services";
import { diagnosticSearch } from "./status-search";

export class StatusToggleButtons extends React.Component {

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
      splSrv.events.register("onDiagnosticSearchSave", () => me.setToggleVisibility(), false);
   }

   setToggleVisibility() {
      const me = this;
      const visibleDiags = Object.values(diagnosticSearch.displayList).filter(diagObj => { return diagObj.visible; });
      if (Object.keys(diagnosticSearch.displayList).length && !visibleDiags.length) {
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
               id="toggleStatus"
               className={`toggleButton ${this.state.visibility ? "shown" : "notShown"
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
