import * as vscode from "vscode";

export async function copyToClipboard(text: string) {
  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage("Text copied to clipboard!");
}

export const getCodeSelectionText = () => {
  const editor = vscode.window.activeTextEditor;
  // Get the selected code
  if (!editor) {
    vscode.window.showErrorMessage("No open editor found");
    return;
  }
  const selection = editor?.selection;
  const selectedText = editor?.document.getText(selection);
  if (!selectedText) {
    vscode.window.showErrorMessage("Please select some code to perform action");
    return;
  }
  return selectedText;
};

export const appendText = (textToAdd: string) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No open editor found");
    return;
  }
  const currentPosition = editor?.selection?.active;
  const newPosition = currentPosition?.with(
    currentPosition.line,
    currentPosition.character
  );
  editor?.edit((editBuilder) => {
    if (!newPosition) {
      vscode.window.showErrorMessage("can't find your cursor, try again.");
      return;
    }
    editBuilder.insert(newPosition, `\n${textToAdd}\n\n`);
  });
};

export const replaceInEditor = async (textToAdd: string) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No open editor found");
    return;
  }
  const selection = editor?.selection;
  editor?.edit((editBuilder) => {
    editBuilder.replace(selection as vscode.Selection, textToAdd);
  });
};
