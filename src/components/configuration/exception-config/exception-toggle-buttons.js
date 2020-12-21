import React, { Component } from "react";
import splSrv from "../../../spartanlync/services";
import { exceptionSearch } from "./exception-search";

export class ExceptionToggleButtons extends React.Component {

   constructor(props) {
      super(props);
      this.state = { visibility: true };
      this.toggleVisibility = this.toggleVisibility.bind(this);

      this.onLoadMapDataCompletedHandlerId = null;
      this.onExceptionSearchSaveHandlerId = null;
   }

   componentDidMount() {
      const me = this;

      // On Map data Load, reset state of Show/HideAll button
      this.onLoadMapDataCompletedHandlerId = splSrv.events.register("onLoadMapDataCompleted", () => me.setToggleVisibility(), false);

      // On Device Search Save, set visibility of Show/HideAll button
      this.onExceptionSearchSaveHandlerId = splSrv.events.register("onExceptionSearchSave", () => me.setToggleVisibility(), false);
   }
   componentWillUnmount() {
      if (this.onLoadMapDataCompletedHandlerId) {
         splSrv.events.delete("onLoadMapDataCompleted", this.onLoadMapDataCompletedHandlerId);
      }
      this.onLoadMapDataCompletedHandlerId = null;

      if (this.onExceptionSearchSaveHandlerId) {
         splSrv.events.delete("onExceptionSearchSave", this.onExceptionSearchSaveHandlerId);
      }
      this.onExceptionSearchSaveHandlerId = null;
   }

   setToggleVisibility() {
      const me = this;
      const visibleExceptions = Object.values(exceptionSearch.displayList).filter(exceptionObj => { return exceptionObj.visible; });
      if (Object.keys(exceptionSearch.displayList).length && !visibleExceptions.length) {
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
         <div>
            <button
               id="clearExceptions"
               className={`toggleButton ${this.state.visibility ? "shown" : "notShown"
                  }`}
               data-tip="Toggle All Exceptions"
               data-for="splTooltip"
               onClick={() => {
                  this.toggleVisibility();
                  exceptionSearch.setVisibilityForAllItems(
                     !this.state.visibility,
                     this.props.setExceptionsDisplay
                  );
               }}
            ></button>
            <button
               id="deleteExceptions"
               className="deleteButton"
               data-tip="Delete All Exceptions"
               data-for="splTooltip"
               onClick={() =>
                  exceptionSearch.deleteAllItems(this.props.setExceptionsDisplay)
               }
            ></button>
         </div>
      );
   }
}
