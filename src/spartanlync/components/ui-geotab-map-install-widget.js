// eslint-disable-next-line no-unused-vars
import React, { Component } from "react";
import splSrv from "../services";
import { InitSecurityClearanceAPI } from "../services/api/security-clearance";
import { makeAPICall, makeAPIMultiCall } from "../../services/api/helpers";
import { showSnackBar } from "../../components/snackbar/snackbar";
import { apiConfig } from "../../dataStore/api-config";

/**
 *  Render button to show the Installation Status of the SpartanLync Deeper Add-In for MyGeotab Map
 *  within the current Logged-In MyGeotab user account
 *
 *  @returns JSX object
 */
export class SplGeotabMapInstallationStatusBtn extends Component {

   constructor(props) {
      super(props);

      this.splDeeperAddInName = splSrv.splDeeperAddIn.name;
      this.splDeeperAddInJSON = splSrv.splDeeperAddIn.json;

      this.initMsg = splSrv.splDeeperAddIn.msgs.initMsg;
      this.successMsg = splSrv.splDeeperAddIn.msgs.successMsg;
      this.installBtnLbl = splSrv.splDeeperAddIn.msgs.installBtnLbl;
      this.unInstallBtnLbl = splSrv.splDeeperAddIn.msgs.unInstallBtnLbl;

      this.addInInstalledMsg = splSrv.splDeeperAddIn.msgs.addInInstalledMsg;
      this.addInNotInstalledMsg = splSrv.splDeeperAddIn.msgs.addInNotInstalledMsg;

      this.failureMsg = splSrv.splDeeperAddIn.msgs.failureMsg;
      this.initFailureMsg = splSrv.splDeeperAddIn.msgs.initFailureMsg;
      this.errFetchUserDataMsg = splSrv.splDeeperAddIn.msgs.errFetchUserDataMsg;
      this.errFetchSystemDataMsg = splSrv.splDeeperAddIn.msgs.errFetchSystemDataMsg;

      this.featurePreviewEnabledForUser = splSrv.splDeeperAddIn.msgs.featurePreviewEnabledForUser;
      this.featurePreviewOpSuccessMsg = splSrv.splDeeperAddIn.msgs.featurePreviewOpSuccessMsg;
      this.featurePreviewOpFailureMsg = splSrv.splDeeperAddIn.msgs.featurePreviewOpFailureMsg;

      this.cannotInstallBtnLbl = splSrv.splDeeperAddIn.msgs.cannotInstallBtnLbl;
      this.cannotInstallBtnSubLbl = splSrv.splDeeperAddIn.msgs.cannotInstallBtnSubLbl;

      this.init = this.init.bind(this);
      this.onClickHandler = this.onClickHandler.bind(this);

      this.state = {
         isInstalled: false,
         btnMsg: "",
         btnSubMsg: "",
         btnDisabled: false
      };

      this.isAdministrator = false;
      this.user = null;
      this.sysSettings = null;
      this.secClearance = null;
   }


   /**
    * On Component Load
    *
    *  @returns void
    */
   componentDidMount() {
      const me = this;
      me.msgMgr("init");

      // Register a callback, invoked when SplTools is successfully initialized
      splSrv.events.register("onLoadSplServices", me.init, false);
   }


   /**
    * Init by
    * 1. Fetch current User priviliges and Add-Ins Installed
    * 2. Enable Feature Preview for Current User
    * 3. Launch SpartanLync Deeper Add-In Installation if Add-In is missing
    * 4. Report any errors if 1-3 fail
    *
    *  @returns void
    */
   init() {
      const me = this;
      let isAddInInstalled = false;

      makeAPIMultiCall(
         [
            ["Get", {
               "typeName": "User",
               search: {
                  name: splSrv._credentials.username
               }
            }],
            ["Get", {
               "typeName": "SystemSettings"
            }]
         ])
         .then(results => {
            // Store User and SystemSettings
            if (!results[0].length) {
               throw new Error(me.errFetchUserDataMsg);
            }
            me.user = results[0][0];
            if (!results[1].length) {
               throw new Error(me.errFetchSystemDataMsg);
            }
            me.sysSettings = results[1][0];

            // Enable user feature preview, if disabled
            if (me.user.isLabsEnabled) {
               console.log(me.featurePreviewEnabledForUser.replace("{username}", me.user.name));
            }
            else {
               me.manageFeaturePreview("install");
            }

            // Check if SpartanLync Deeper Add-In Installed
            if (typeof me.sysSettings.customerPages !== "undefined" && me.sysSettings.customerPages.length) {
               if (typeof me.sysSettings.customerPages.find(a => a.includes(me.splDeeperAddInName)) === "undefined") {
                  console.log(me.addInNotInstalledMsg);
                  isAddInInstalled = false;
               }
               else {
                  console.log(me.addInInstalledMsg);
                  isAddInInstalled = true;
               }
            }
            else {
               isAddInInstalled = false;
            }

            // Check for Admin priviliges to Install/Uninstall SpartanLync Deeper Add-In for Geotab Map
            me.havePrivsToInstallSpartanLyncDeeperAddIn()
               .then(() => {
                  if (isAddInInstalled) {
                     me.msgMgr("install-success", true);
                  }
                  else {
                     me.msgMgr("uninstall-success", true);
                  }
               })
               .catch(reason => {
                  if (reason === "NON-ADMIN") {
                     me.msgMgr("not-enough-privs", true);
                  }
                  else {
                     me.msgMgr("init-failure", false, reason);
                  }
               });
         })
         .catch(reason => {
            me.msgMgr("init-failure", false, reason);
         });
   };


   /**
    * Verify If Admin priviliges to Install SpartanLync Deeper Add-In for Geotab Map
    *
    *  @returns promise
    */
   havePrivsToInstallSpartanLyncDeeperAddIn() {
      const me = this;
      return new Promise((resolve, reject) => {
         if (typeof me.user.name === "undefined" || !me.user.name) {
            reject("Missing or Invalid User Object");
         }
         if (typeof me.user.name === "undefined" || !me.user.name || !Array.isArray(me.sysSettings.customerPages)) {
            reject("AddIn / customerPages Array Invalid");
         }
         me.secClearance = new InitSecurityClearanceAPI(apiConfig.api, me.user, function () {
            if (me.secClearance.userInheritsFrom("Administrator")) {
               me.isAdministrator = true;
               resolve("ADMIN");
            }
            else {
               me.isAdministrator = false;
               reject("NON-ADMIN");
            }
         });
      });
   };


   /**
    * Install/Uninstall SpartanLync Deeper Add-In for Geotab Map
    *
    *  @returns void
    */
   manageSpartanLyncDeeperAddIn(op) {
      const me = this;
      const operation = op || "install";
      let addInFound = false;

      return new Promise((resolve, reject) => {

         // Sanity Check SystemSettings Object
         if (typeof me.sysSettings.customerPages === "undefined" ||
            typeof me.sysSettings.dataVersion === "undefined" ||
            !Array.isArray(me.sysSettings.customerPages)) {
            reject("Missing or Invalid SystemSettings Object");
         }
         addInFound = typeof me.sysSettings.customerPages.find(a => a.includes(me.splDeeperAddInName)) === "undefined" ? false : true;
         if ((addInFound && operation === "install") || (!addInFound && operation !== "install")) {
            reject(
               "SpartanLync Deeper Add-In [ " + me.splDeeperAddInName + " ] " +
               (operation === "install" ? "already exists" : "does not exist") +
               " in SystemSettings Object...Cannot " +
               (operation === "install" ? "Install" : "Uninstall")
            );
         }

         // Get updated copy of SystemSettings
         makeAPICall("Get",
            {
               "typeName": "SystemSettings"
            })
            .then(results => {
               if (!results.length) {
                  throw new Error(me.errFetchSystemDataMsg);
               }
               me.sysSettings = results[0];

               // Update customerPages Array
               if (operation === "install") {
                  me.sysSettings.customerPages.push(me.splDeeperAddInJSON);
               }
               else {
                  me.sysSettings.customerPages = me.sysSettings.customerPages.filter((addinJSON) => {
                     return addinJSON.indexOf(me.splDeeperAddInName) === -1;
                  });
               }

               // Perform Operation
               makeAPICall("Set",
                  {
                     "typeName": "SystemSettings",
                     "entity": {
                        dataVersion: me.sysSettings.dataVersion,
                        customerPages: me.sysSettings.customerPages
                     }
                  })
                  .then(() => {
                     me.msgMgr((operation === "install" ? "install" : "uninstall") + "-success");
                  })
                  .catch(reason => {
                     me.msgMgr((operation === "install" ? "install" : "uninstall") + "-failure", false, reason);
                  });
            })
            .catch(reason => {
               me.msgMgr((operation === "install" ? "install" : "uninstall") + "-failure", false, reason);
            });
      });
   };


   /**
    * Enable/Disable Feature Preview for current User Account, via Geotab API
    *
    *  @returns void
    */
   manageFeaturePreview(op) {
      const me = this;
      const operation = op || "install";

      makeAPICall("Set",
         {
            "typeName": "User",
            "entity": {
               id: me.user.id,
               isLabsEnabled: operation === "install" ? true : false
            }
         })
         .then(() => {
            console.log(
               me.featurePreviewOpSuccessMsg
                  .replace("{op}", operation === "install" ? "Enabled" : "Disabled")
                  .replace("{username}", me.user.name)
            );
         })
         .catch(reason => {
            me.msgMgr("feature-preview-" + (operation === "install" ? "install" : "uninstall") + "-failure", false, reason);
         });
   };


   /**
    * When supplied with an action result, manage state and
    * (a) generate approriate button label
    * (b) create notification messaging
    *
    *  @returns void
    */
   msgMgr(result, quietMode, faultMsg) {
      const me = this;
      const silentMode = quietMode || false;
      const faultReason = faultMsg || "";
      let msg = "";

      switch (result) {
         case "install-success":
            msg = me.successMsg.replace("{op}", "Installed").replace("{intofrom}", "into");
            me.setState({
               btnMsg: me.unInstallBtnLbl,
               btnSubMsg: "",
               btnDisabled: false,
               isInstalled: true
            });
            break;

         case "install-failure":
            msg = me.failureMsg.replace("{op}", "Install").replace("{tofrom}", "to");
            break;

         case "uninstall-success":
            msg = me.successMsg.replace("{op}", "Removed").replace("{intofrom}", "from");
            me.setState({
               btnMsg: me.installBtnLbl,
               btnSubMsg: "",
               btnDisabled: false,
               isInstalled: false
            });
            break;

         case "uninstall-failure":
            msg = me.failureMsg.replace("{op}", "Remove").replace("{tofrom}", "from");
            break;

         case "not-enough-privs":
            msg = "--- " + me.cannotInstallBtnLbl + ": " + me.cannotInstallBtnSubLbl;
            me.setState({
               btnMsg: me.cannotInstallBtnLbl,
               btnSubMsg: me.cannotInstallBtnSubLbl,
               btnDisabled: true,
               isInstalled: false
            });
            break;

         case "feature-preview-install-failure":
            msg = me.featurePreviewOpFailureMsg.replace("{op}", "Install").replace("{username}", me.user.name);
            break;

         case "feature-preview-uninstall-failure":
            msg = me.featurePreviewOpFailureMsg.replace("{op}", "Uninstall").replace("{username}", me.user.name);
            break;

         case "init-failure":
            msg = me.initFailureMsg;
            me.setState({
               btnMsg: me.initFailureMsg,
               btnSubMsg: "",
               btnDisabled: true,
               isInstalled: false
            });
            break;

         default:
            me.setState({
               btnMsg: me.initMsg,
               btnSubMsg: "",
               btnDisabled: false,
               isInstalled: false
            });
      }
      if (msg) {
         msg += faultReason ? (": " + faultReason) : "";
         console.log(msg);
         if (!silentMode) {
            showSnackBar(msg);
         }
      }
   }


   /**
    * Click Handler, invoked once user decides to perform an Install/Uninstall action
    *
    *  @returns void
    */
   onClickHandler() {
      const me = this;
      me.havePrivsToInstallSpartanLyncDeeperAddIn()
         .then(() => {
            if (me.state.isInstalled) {
               me.manageSpartanLyncDeeperAddIn("uninstall");
            }
            else {
               me.manageSpartanLyncDeeperAddIn("install");
            }
         })
         .catch(reason => {
            if (reason === "NON-ADMIN") {
               me.msgMgr("not-enough-privs", true);
            }
            else {
               me.msgMgr((me.state.isInstalled ? "uninstall" : "install") + "-failure", false, reason);
            }
         });
   }


   render() {
      const me = this;
      const btnDisabledClass = me.state.btnDisabled ? "disabled" : "";
      return (
         <div className={`spl-geotab-map-install-status-btn ${btnDisabledClass}`}
            {...(!me.state.btnDisabled && {
               "onClick": me.onClickHandler
            })}>
            {me.state.btnMsg}
            {me.state.btnSubMsg ? <div>( {me.state.btnSubMsg} )</div> : ""}
         </div>
      );
   }
};

