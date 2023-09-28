import * as vscode from "vscode";
import "./fetch-polyfill";
import { CodesenseaiViewProvider } from "./CodesenseaiViewProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new CodesenseaiViewProvider(
    context.extensionUri,
    context.globalState
  );
  const openChat = vscode.window.registerWebviewViewProvider(
    CodesenseaiViewProvider.viewType,
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true },
    }
  );
  context.subscriptions.push(openChat);
}

// This method is called when your extension is deactivated
export function deactivate() {}
