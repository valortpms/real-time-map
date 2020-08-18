import React, { Component } from "react";
import { exceptionSearch } from "./exception-search";

export class ExceptionToggleButtons extends React.Component {
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
         <div>
            <button
               id="clearExceptions"
               className={`toggleButton ${
                  this.state.visibility ? "shown" : "notShown"
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
