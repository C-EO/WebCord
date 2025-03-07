import { app, dialog } from "electron/main";
import kolor from "@spacingbat3/kolor";
import { stripVTControlCharacters } from "util";
import { sep } from "path";

let prevDialog:Promise<unknown> = Promise.resolve();

export const commonCatches = {
  print: (reason:unknown) => {
    if(reason instanceof Error)
      console.error(reason.message);
    else
      console.error(reason);
  },
  throw: (reason:unknown) => {
    if(reason instanceof Error)
      throw reason;
    else if(typeof reason === "string")
      throw new Error(reason);
  }
};

async function handleWithGUI(wasReady:boolean, name:string, message:string, stack:string, stackColor:string, error:Error&NodeJS.ErrnoException) {
  if(!app.isReady()) await app.whenReady();
  let buttons:[string,string] = ["Abort", "Ignore"];
  if(new Date().getMonth() === 3 && new Date().getDate() === 1)
    // You saw nothing!
    buttons = ["Abort, abort!", "Not today, Satan!"];
  if(wasReady) console.error("\n" + kolor.red(kolor.bold(name)) + kolor.blue(message) + stackColor);
  let dialogAPI;
  try {
    dialogAPI = (await import("../../common/modules/client.js")).getBuildInfo().type === "devel" ? dialog.showMessageBox.bind(dialog) : dialog.showMessageBoxSync.bind(dialog);
  } catch {
    dialogAPI = dialog.showMessageBoxSync.bind(dialog);
  }
  const result = await dialogAPI({
    title: name,
    message: error.message + stack,
    type: "error",
    buttons: buttons,
    cancelId: 0,
    defaultId: 0,
  });
  let errCode: number;
  switch (error.name) {
    case "Error":
      if (error.errno !== undefined || error.code !== undefined ||
          error.syscall !== undefined || error.path !== undefined)
        errCode = 99;
      else
        errCode = 101;
      break;
    case "TypeError":
      errCode = 102;
      break;
    case "SyntaxError":
      errCode = 103;
      break;
    case "RangeError":
      errCode = 104;
      break;
    case "EvalError":
      errCode = 105;
      break;
    case "ReferenceError":
      errCode = 106;
      break;
    case "URIError":
      errCode = 107;
      break;
    case "AggregateError":
      errCode = 108;
      break;
    default:
      errCode = 100;
  }
  if((typeof result === "number"?result:result.response) === 0) {
    process.removeAllListeners("uncaughtException");
    console.error("\nApplication crashed (Error code: " + errCode.toString() + (error.errno !== undefined ? ", ERRNO: " + error.errno.toString() : "") + ")\n");
    app.exit(errCode);
  } else {
    console.warn([
      "Ignored an unhandled error. This may lead to undesirable consequences.",
      "You do this at your own risk!"
    ].join("\n"));
  }
}

/* Handles uncaughtException errors */

export default function uncaughtExceptionHandler(): void {
  process.removeAllListeners("uncaughtException").on("uncaughtException", (error:Error&NodeJS.ErrnoException,origin) => {
    let wasReady = false;
    if(app.isReady()) wasReady = true;
    let stack = "", message = "", stackColor = "";
    const name = `${
      (origin[0]?.toLocaleUpperCase()??"")+origin.substring(1) as Capitalize<typeof origin>
    }: ${app.getName()} threw '${error.name}'.` as const;
    if (error.message !== "")
      message = "\n\n" + error.message;

    if (error.stack !== undefined) {
      stack = "\n" + error.stack
        .replace(error.name + ": " + error.message, "");
      stackColor = stack;
      const stackLines = stack.split(/\r\n|\n|\r/);
      const stackProcessed: string[] = [], stackColorProcessed: string[] = [];
      const appPath = app.getAppPath()+sep;
      for (let line of stackLines) if (/^\s*at/.exec(line) && line.includes(appPath)) {
        line = line.replace(appPath, "");
        stackProcessed.push(line);
        stackColorProcessed.push(line);
      } else {
        stackColorProcessed.push(kolor.gray(line));
      }
      if (error.message !== "")
        stack = "\n\n" + stackProcessed.join("\n");
      else
        stack = stackProcessed.join("\n");
      stackColor = stackColorProcessed.join("\n");
      if(!stack.includes("at"))
        stack = stripVTControlCharacters(stackColor);
    }
    prevDialog = prevDialog.then(() => handleWithGUI(wasReady,name,message,stack,stackColor,error).catch(() => app.exit(200)));
  });
}