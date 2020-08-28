import React, { Component } from "react";
import { diagnosticSearch } from "./status-search";
import splSrvTools from "../../../spartanlync/services/tools";

export const StatusListComponent = props => {
   const mapPropsToComponent = props.setStatusDisplay;
   const statusList =
      props.statusDisplayList.length > 0
         ? props.statusDisplayList.map(prop => (
            <li key={prop.id} className="mdc-list-item">
               <span
                  className={`RTM-iconSquare mdc-list-item__graphic material-icons filterIcon ${
                     prop.visible ? "showConfig" : "hideConfig"
                     }`}
                  data-tip="Hide/Show Status"
                  data-for="splTooltip"
                  onClick={() =>
                     diagnosticSearch.toggleStatusVisibility(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <span className="mdc-list-item__graphic material-icons status"></span>
               <span
                  id={"RTMnode-" + prop.id}
                  className="RTM-ConfigListItem mdc-list-item__text"
               >
                  {prop.name}
               </span>
               <span
                  className="mdc-list-item__meta material-icons"
                  data-tip="Remove this Status"
                  data-for="splTooltip"
                  onClick={() =>
                     diagnosticSearch.deleteItemFromStatusList(
                        prop.id,
                        mapPropsToComponent
                     )
                  }
               ></span>
               <img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' className="loader" onLoad={splSrvTools.trOnElementLoad.status}></img>
            </li>
         ))
         : [];
   return statusList;
};
