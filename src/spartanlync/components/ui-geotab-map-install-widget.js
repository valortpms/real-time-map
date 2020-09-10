// eslint-disable-next-line no-unused-vars
import React, { Component } from "react";
import splSrv from "../services";
import Swal from "sweetalert2";
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

      this.initMsg = "";
      this.appTitle = "";
      this.successMsg = "";
      this.failureMsg = "";
      this.installBtnLbl = "";
      this.initFailureMsg = "";
      this.unInstallBtnLbl = "";
      this.addInInstalledMsg = "";
      this.cannotInstallBtnLbl = "";
      this.errFetchUserDataMsg = "";
      this.addInNotInstalledMsg = "";
      this.errFetchSystemDataMsg = "";
      this.myAccountEnableBtnLbl = "";
      this.myAccountDisableBtnLbl = "";
      this.cannotInstallBtnSubLbl = "";
      this.featurePreviewOpSuccessMsg = "";
      this.featurePreviewOpFailureMsg = "";
      this.featurePreviewEnabledForUser = "";

      this.init = this.init.bind(this);
      this.onClickEveryoneHandler = this.onClickEveryoneHandler.bind(this);
      this.onClickMyAccountHandler = this.onClickMyAccountHandler.bind(this);
      this.onAppFocusHandler = this.onAppFocusHandler.bind(this);

      this.state = {
         btnEveryoneDisabled: false,
         btnEveryoneMsg: "",
         btnAccountMsg: "",
         subMsg: ""
      };

      this.isAddInInstalled = false;
      this.isAdministrator = false;
      this.user = null;
      this.sysSettings = null;
      this.secClearance = null;

      this.getInstallConsent = new this.INITGetInstallConsentDialog(this);
   }


   /**
    * On Component Load
    *
    *  @returns void
    */
   componentDidMount() {
      const me = this;
      me.msgMgr("init");

      // Register a callback, invoked when SplMap has successfully initialized
      splSrv.events.register("onLoadSplServices", me.init, false);
   }


   /**
    * Init by
    * 1. Load UI messages in current language from multi-langugae library
    * 2. Verifying Account priviliges and Installation status of MyGeotab Map Deeper Add-In
    * 3. Register Handlers for Buttons in UI and Refresh of Account/Add-In status on App Focus events
    * 4. Report any errors if 1-3 fail to occur
    *
    *  @returns void
    */
   init() {
      const me = this;

      // Init UI msgs in App Language
      me.initLangMsgs();

      // Register Handler for updating local Account Object when App comes into focus
      splSrv.events.register("onAppFocus", me.onAppFocusHandler, false);

      // Perform checks on Add-In installation and Account Priviliges
      me.verifyInstallationAndPrivs();
   };


   /**
    * Init Msg(s) in user-defined Language
    *
    *  @returns void
    */
   initLangMsgs() {
      const me = this;

      me.initMsg = splmap.tr("splgeotabmap_init_msg");
      me.appTitle = splmap.tr("splgeotabmap_title");
      me.successMsg = splmap.tr("splgeotabmap_success_msg");
      me.installBtnLbl = splmap.tr("splgeotabmap_install_btnlbl");
      me.unInstallBtnLbl = splmap.tr("splgeotabmap_uninstall_btnlbl");

      me.addInInstalledMsg = splmap.tr("splgeotabmap_addin_installed_msg");
      me.addInNotInstalledMsg = splmap.tr("splgeotabmap_addIn_notinstalled_msg");

      me.failureMsg = splmap.tr("splgeotabmap_failure_msg");
      me.initFailureMsg = splmap.tr("splgeotabmap_init_failure_msg");
      me.errFetchUserDataMsg = splmap.tr("splgeotabmap_err_fetch_userdata_msg");
      me.errFetchSystemDataMsg = splmap.tr("splgeotabmap_err_fetch_systemdata_msg");

      me.myAccountEnableBtnLbl = splmap.tr("splgeotabmap_my_account_enable");
      me.myAccountDisableBtnLbl = splmap.tr("splgeotabmap_my_account_disable");

      me.featurePreviewEnabledForUser = splmap.tr("splgeotabmap_feature_preview_enabled_foruser");
      me.featurePreviewOpSuccessMsg = splmap.tr("splgeotabmap_feature_preview_op_success_msg");
      me.featurePreviewOpFailureMsg = splmap.tr("splgeotabmap_feature_preview_op_failure_msg");

      me.cannotInstallBtnLbl = splmap.tr("splgeotabmap_no_install_btnlbl");
      me.cannotInstallBtnSubLbl = splmap.tr("splgeotabmap_no_install_btnsublbl");
   };


   /**
    *  Modal dialog box component for getting consent to install SplGeotabMap
    */
   INITGetInstallConsentDialog(parentObj) {

      this._parent = null;
      this._SwalOptions = {
         html: null,
         confirmButtonText: null,
         confirmButtonAriaLabel: null,
         cancelButtonText: null,
         cancelButtonAriaLabel: null,
         customClass: {
            popup: "spl-modal-popup",
            content: "spl-modal-content",
         },
         target: "#RTM-ViewContainer",
         allowOutsideClick: false,
         allowEscapeKey: false,
         showCloseButton: false,
         showCancelButton: true,
         focusConfirm: false,
         heightAuto: false
      };

      // Show consent dialog
      // (1) If user has not already skipped the consent notice
      // (2) after any possible flying-to-vehicle event
      this.show = function () {
         const me = this;
         if (typeof splSrv.splStore.splMap.splGeotabMapOptOut === "undefined") {
            if (splSrv._pendingFlyingEvent) {
               splSrv.events.register("postFlyingComplete", () => me.showConsentDialog(), false);
            }
            else {
               me.showConsentDialog();
            }
         }
      };

      this.showConsentDialog = function () {
         const me = this;

         me._SwalOptions.confirmButtonText = me._SwalOptions.confirmButtonAriaLabel = splmap.tr("splgeotabmap_consent_btn_label_install");
         me._SwalOptions.cancelButtonText = me._SwalOptions.cancelButtonAriaLabel = splmap.tr("splgeotabmap_consent_btn_label_skip");
         me._SwalOptions.html =
            "<div class='splgeotabmap-consent-graphic'>" + splmap.tr("splgeotabmap_consent_install_msg") +
            "</div><i class='splgeotabmap-consent-uninstall-msg'>" + splmap.tr("splgeotabmap_consent_uninstall_msg") +
            "<span></span></i>";

         Swal.fire(me._SwalOptions)
            .then((result) => {
               if (result.isConfirmed) {
                  me.giveConsent();
               }
               else if (result.dismiss === Swal.DismissReason.cancel) {
                  me.skipConsent();
               }
            })
            .catch(() => me.skipConsent());
      };

      this.giveConsent = function () {
         const me = this;
         const my = me._parent;
         my.manageSpartanLyncDeeperAddIn("install");
      };

      // Add a SplGeotabMap opt-out flag to this user account configuration on SpartanLync server
      this.skipConsent = function () {
         if (typeof splSrv.splStore.splMap.splGeotabMapOptOut === "undefined") {
            const splStoreRec = splSrv.splStore;
            splStoreRec.splMap.splGeotabMapOptOut = true;
            splSrv.splStore = splStoreRec;
         }
      };

      this.configure = function (parentObj) {
         this._parent = parentObj;
      };

      // configure when an instance gets created
      this.configure(parentObj);
   };


   /**
    * Perform checks on Add-In installation and Account Priviliges
    *
    *  @returns void
    */
   verifyInstallationAndPrivs() {
      const me = this;

      // Fetch User / SystemSettings configurations
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

            // Check if SpartanLync Deeper Add-In Installed
            if (typeof me.sysSettings.customerPages !== "undefined" && me.sysSettings.customerPages.length) {
               if (typeof me.sysSettings.customerPages.find(a => a.includes(me.splDeeperAddInName)) === "undefined") {
                  console.log(me.addInNotInstalledMsg);
                  me.isAddInInstalled = false;
               }
               else {
                  console.log(me.addInInstalledMsg);
                  me.isAddInInstalled = true;
               }
            }
            else {
               me.isAddInInstalled = false;
            }

            // Verify and activate account feature preview as required by user
            me.verifyAccountFeaturePreview();

            // Check for Admin priviliges to Install/Uninstall SpartanLync Deeper Add-In for Geotab Map
            me.havePrivsToInstallSpartanLyncDeeperAddIn()
               .then(() => {
                  if (me.isAddInInstalled) {
                     me.msgMgr("install-success", true);
                  }
                  else {
                     me.msgMgr("uninstall-success", true);
                     me.getInstallConsent.show();  // Show User Opt-In dialog
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
            reject(splmap.tr("error_invalid_user"));
         }
         if (typeof me.user.name === "undefined" || !me.user.name || !Array.isArray(me.sysSettings.customerPages)) {
            reject(splmap.tr("error_invalid_addin_array"));
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
            reject(splmap.tr("error_systemsettings_missing_invalid"));
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
    * Verify Feature Preview Enabled.
    * 1. If disabled, and
    * 2. User has not opt-out of using SpartanLync on MyGeotab Map, then
    * 3. Enable it
    *
    *  @returns void
    */
   verifyAccountFeaturePreview() {
      const me = this;

      // Log whether account feature preview is enabled
      if (me.user.isLabsEnabled) {
         console.log(me.featurePreviewEnabledForUser.replace("{username}", me.user.name));
      }
      // If user has not opt-out of featurePreview, enable it
      else {
         if (typeof splSrv.splStore.splMap.featurePreviewOptOut === "undefined") {
            me.manageFeaturePreview("install");
         }
      }
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
            // On enable operation, remove featurePreview opt-out flag from user account config on SpartanLync server
            if (operation === "install") {
               if (typeof splSrv.splStore.splMap.featurePreviewOptOut !== "undefined") {
                  const splStoreRec = splSrv.splStore;
                  delete splStoreRec.splMap.featurePreviewOptOut;
                  splSrv.splStore = splStoreRec;
               }
            }
            // On disable operation, set featurePreview opt-out flag in user account config on SpartanLync server
            else {
               const splStoreRec = splSrv.splStore;
               splStoreRec.splMap.featurePreviewOptOut = true;
               splSrv.splStore = splStoreRec;
            }
            me.user.isLabsEnabled = operation === "install" ? true : false; // Sync local copy with new user account state
            me.msgMgr("feature-preview-successful-operation");
         })
         .catch(reason => me.msgMgr("feature-preview-" + (operation === "install" ? "install" : "uninstall") + "-failure", false, reason));
   };


   /**
    * When supplied with an action result, manage state and
    * (a) generate approriate button label
    * (b) create notification messaging
    *
    *  @returns void
    */
   // eslint-disable-next-line complexity
   msgMgr(result, quietMode, faultMsg) {
      const me = this;
      const silentMode = quietMode || false;
      const faultReason = faultMsg || "";
      let msg = "";

      switch (result) {
         case "install-success":
            msg = silentMode ? "" : me.successMsg.replace("{op}", "Installed").replace("{intofrom}", "into");
            me.isAddInInstalled = true;
            me.setState({
               btnEveryoneDisabled: false,
               btnEveryoneMsg: me.unInstallBtnLbl,
               btnAccountMsg: me.user.isLabsEnabled ? me.myAccountDisableBtnLbl : me.myAccountEnableBtnLbl,
               subMsg: "",
            });
            break;

         case "install-failure":
            msg = me.failureMsg.replace("{op}", "Install").replace("{tofrom}", "to");
            break;

         case "uninstall-success":
            msg = silentMode ? "" : me.successMsg.replace("{op}", "Removed").replace("{intofrom}", "from");
            me.isAddInInstalled = false;
            me.setState({
               btnEveryoneDisabled: false,
               btnEveryoneMsg: me.installBtnLbl,
               btnAccountMsg: me.user.isLabsEnabled ? me.myAccountDisableBtnLbl : me.myAccountEnableBtnLbl,
               subMsg: "",
            });
            break;

         case "uninstall-failure":
            msg = me.failureMsg.replace("{op}", "Remove").replace("{tofrom}", "from");
            break;

         case "not-enough-privs":
            const cannotInstallHtml = me.cannotInstallBtnLbl.replace("{op}", me.isAddInInstalled ? "Remove" : "Add");
            msg = "--- " + cannotInstallHtml + ": " + me.cannotInstallBtnSubLbl;
            me.setState({
               btnEveryoneDisabled: true,
               btnEveryoneMsg: cannotInstallHtml,
               btnAccountMsg: me.user.isLabsEnabled ? me.myAccountDisableBtnLbl : me.myAccountEnableBtnLbl,
               subMsg: me.cannotInstallBtnSubLbl,
            });
            break;

         case "feature-preview-successful-operation":
            msg = me.featurePreviewOpSuccessMsg
               .replace("{op}", me.user.isLabsEnabled ? "Enabled" : "Disabled")
               .replace("{username}", me.user.name);
            me.setState({
               btnAccountMsg: me.user.isLabsEnabled ? me.myAccountDisableBtnLbl : me.myAccountEnableBtnLbl,
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
            me.isAddInInstalled = false;
            me.setState({
               btnEveryoneDisabled: true,
               btnEveryoneMsg: me.initFailureMsg,
               btnAccountMsg: "",
               subMsg: "",
            });
            break;

         default:
            me.isAddInInstalled = false;
            me.setState({
               btnEveryoneDisabled: false,
               btnEveryoneMsg: me.initMsg,
               btnAccountMsg: "",
               subMsg: "",
            });
      }
      if (msg) {
         msg += faultReason ? (": " + faultReason) : "";
         console.log(msg);
         if (!silentMode) {
            showSnackBar(msg);
         }
      }
   };


   /**
    * Click Handler for Everyone Button
    * Invoked when Admin decides to Install/Uninstall Add-In from Database
    *
    *  @returns void
    */
   onClickEveryoneHandler() {
      const me = this;
      me.havePrivsToInstallSpartanLyncDeeperAddIn()
         .then(() => {
            if (me.isAddInInstalled) {
               me.manageSpartanLyncDeeperAddIn("uninstall");
            }
            else {
               me.manageSpartanLyncDeeperAddIn("install");
            }

            // If exist, remove the SplGeotabMap opt-out flag from SpartanLync servers
            if (typeof splSrv.splStore.splMap.splGeotabMapOptOut !== "undefined") {
               const splStoreRec = splSrv.splStore;
               delete splStoreRec.splMap.splGeotabMapOptOut;
               splSrv.splStore = splStoreRec;
            }
         })
         .catch(reason => {
            if (reason === "NON-ADMIN") {
               me.msgMgr("not-enough-privs", true);
            }
            else {
               me.msgMgr((me.isAddInInstalled ? "uninstall" : "install") + "-failure", false, reason);
            }
         });
   };


   /**
    * Click Handler for MyAccount Button
    * Invoked to Enable/Disable the Feature Preview account option
    *
    *  @returns void
    */
   onClickMyAccountHandler() {
      const me = this;
      me.manageFeaturePreview(me.user.isLabsEnabled ? "uninstall" : "install");
   };


   /**
    * Handler for updating local Account Object when App comes into focus
    *
    *  @returns void
    */
   onAppFocusHandler() {
      const me = this;
      me.verifyInstallationAndPrivs(); // Perform checks on Add-In installation and Account Priviliges
   };

   render() {
      const me = this;
      const btnEveryoneDisabledClass = me.state.btnEveryoneDisabled ? " disabled" : "";
      const isSingleButtonClass = me.isAddInInstalled && me.state.btnAccountMsg ? "" : " single-button";

      return (
         <div className="spl-geotab-map-install-btn-container">
            <hr />
            <label>{me.appTitle}:</label>
            <div className={`spl-geotab-map-install-btn-group${isSingleButtonClass}`}>
               <div className={`spl-geotab-map-install-status-btn${btnEveryoneDisabledClass}`}
                  {...(!me.state.btnEveryoneDisabled && {
                     "onClick": me.onClickEveryoneHandler
                  })}>
                  {me.state.btnEveryoneMsg}
               </div>
               {me.isAddInInstalled && me.state.btnAccountMsg ?
                  <div className="spl-geotab-map-install-status-btn" onClick={this.onClickMyAccountHandler}>{me.state.btnAccountMsg}</div>
                  : ""
               }
            </div>
            {me.state.subMsg ? <div className="sub-msg">( {me.state.subMsg} )</div> : ""}
            <hr />
         </div>
      );
   };
};

