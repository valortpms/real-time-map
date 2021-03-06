import React, { Component } from "react";
import { exceptionSearch } from "./exception-search";
import splSrvTools from "../../../spartanlync/services/tools";

export const ExceptionListComponent = props => {
   if (props && props.exceptionDisplayList && !props.exceptionDisplayList.length) {
      return [];
   }
   // Sort by Vehicle Name
   props.exceptionDisplayList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

   const mapPropsToComponent = props.setExceptionsDisplay;
   const exceptionList =
      props.exceptionDisplayList.length > 0
         ? props.exceptionDisplayList.map(prop => (
            <li key={prop.id} className="mdc-list-item">
               <span
                  className={`RTM-iconSquare mdc-list-item__graphic material-icons filterIcon ${prop.visible ? "showConfig" : "hideConfig"
                     } `}
                  data-tip="Hide/Show Exception"
                  data-for="splTooltip"
                  onClick={() =>
                     exceptionSearch.toggleExceptionVisibility(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <span
                  className="RTM-iconSquare mdc-list-item__graphic material-icons exception"
                  style={{
                     backgroundColor: `rgba(${prop.color["r"]},${prop.color["g"]},${prop.color["b"]})`
                  }}
               ></span>
               <span
                  id={"RTMnode-" + prop.id}
                  className="RTM-ConfigListItem mdc-list-item__text"
               >
                  {prop.name}
               </span>
               <span
                  className="mdc-list-item__meta material-icons"
                  data-tip="Remove this Exception"
                  data-for="splTooltip"
                  onClick={() =>
                     exceptionSearch.deleteItemFromExceptionList(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' className="loader" onLoad={splSrvTools.trOnElementLoad.exception}></img>
            </li>
         ))
         : [];
   return exceptionList;
};
