import * as vscode from "vscode";
import "./fetch-polyfill";
import { CodesageaiViewProvider } from "./CodesageaiViewProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new CodesageaiViewProvider(
    context.extensionUri,
    context.globalState
  );
  const openChat = vscode.window.registerWebviewViewProvider(
    CodesageaiViewProvider.viewType,
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true },
    }
  );
  context.subscriptions.push(openChat);
}

// This method is called when your extension is deactivated
export function deactivate() {}
