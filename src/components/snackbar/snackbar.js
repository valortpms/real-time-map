import { MDCSnackbar } from "@material/snackbar";

export function showSnackBar(message, timeOut, action = "OK") {
   const snackbar = new MDCSnackbar(document.querySelector(".mdc-snackbar"));
   snackbar.labelText = message;
   snackbar.actionButtonText = action;
   snackbar.timeoutMs = typeof timeOut !== "undefined" && timeOut && !isNaN(timeOut) && timeOut >= 4000 && timeOut <= 10000 ? timeOut : 5000;
   snackbar.open();
};
