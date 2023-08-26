import * as vscode from "vscode";
import { Bard } from "googlebard";
import { main } from "../plugins/Bard";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";

let bardClient = new Bard(
  `__Secure-1PSID=YQhuPqXgJdNLvYfhKD3nLKCMu_WnL-DeDOnZmSU26RKRgWmtCP5E0MWNgE1HnSObgfDIHA.`
);

export async function copyToClipboard(text: string) {
  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage("Text copied to clipboard!");
}

const progress = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
progress.text = "Please wait while we work our magic...";

async function createFile(
  filePath: string,
  fileName: string,
  fileContent: string
) {
  try {
    // Combine the path and file name
    const fullPath = `${filePath}/${fileName}`;

    // Create the file
    await fs.writeFile(fullPath, fileContent);

    vscode.window.showInformationMessage(
      `File created successfully at: ${fullPath}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create file`);
  }
}

async function addContentAtLine(
  filePath: string,
  fileName: string,
  lineNumber: number,
  contentToAdd: string
) {
  try {
    const fullPath = `${filePath}/${fileName}`;

    // Read the file
    let fileContent = await fs.readFile(fullPath, "utf8");

    // Split the content into lines
    let lines = fileContent.split("\n");

    // Insert the content at the specified line number
    lines.splice(lineNumber - 1, 0, contentToAdd);

    // Join the lines back together
    let updatedContent = lines.join("\n");

    // Write the updated content to the file
    await fs.writeFile(fullPath, updatedContent);

    vscode.window.showInformationMessage(
      `Content added successfully at line ${lineNumber} in ${fullPath}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add content to file`);
  }
}

async function executeTerminalCommand(command: string) {
  // Execute the command in the active terminal
  await vscode.commands.executeCommand(
    "workbench.action.terminal.sendSequence",
    {
      text: (command.includes("npm init") ? "npm init -y" : command) + "\n",
    }
  );
  // await vscode.commands.executeCommand(
  //   "workbench.action.terminal.runSelectedText"
  // );
}

async function processSteps(jsonData: { steps: any }) {
  const steps = jsonData.steps;

  try {
    for (const step of steps) {
      const actionsToPerform = step.actionsToPerform;

      for (const action of actionsToPerform) {
        if (action.type === "command") {
          const command = action.command;
          await executeTerminalCommand(command);
        } else if (action.type === "createFile") {
          const { fileName, filePath, fileContent } = action;
          await createFile(filePath, fileName, fileContent);
        } else if (action.type === "updateFile") {
          const { fileName, filePath, fileUpdateStartLine, fileContent } =
            action;
          await addContentAtLine(
            filePath,
            fileName,
            fileUpdateStartLine,
            fileContent
          );
        }
      }
    }

    return { success: true, message: "Successfully created project" };
  } catch (error) {
    return {
      success: false,
      message: `Error while creating project`,
    };
  }
}

const getBardResponse = async ({
  conversationId,
  prompt,
  resultHandler,
  editHandler,
  prevResponse,
  extractJson = false,
}: {
  conversationId?: string;
  prompt: string;
  resultHandler?: (result: string) => string;
  editHandler?: (textToAdd: string) => void;
  prevResponse?: string;
  extractJson?: boolean;
}): Promise<string | undefined> => {
  try {
    progress.show();
    let response;
    if (!conversationId) {
      response = await bardClient.ask(prompt);
    } else {
      response = await bardClient.ask(prompt, conversationId);
    }
    progress.hide();
    if (extractJson) {
      const jsonResponse = extractJsonCode(response, !!prevResponse);
      if (!jsonResponse) {
        if (prevResponse) {
          copyToClipboard(prevResponse as string);
        }
        vscode.window.showErrorMessage(
          "Looks like bard is not responding now, try again later"
        );
        return;
      }
      const appendedJsonResponse = prevResponse
        ? prevResponse + jsonResponse
        : jsonResponse;
      copyToClipboard(appendedJsonResponse);
      if (!response.includes("--End--")) {
        return await getBardResponse({
          conversationId,
          prompt:
            "provide me the exact continuation of previous json response starting from where you left off in the same format as previous response and start the json with ---Continuation-- or if the json necessary to create app is completed in the previous response then start the response with --End--",
          prevResponse: appendedJsonResponse,
        });
      } else {
        copyToClipboard(appendedJsonResponse);
        processSteps(JSON.parse(appendedJsonResponse));
        return appendedJsonResponse;
      }
    }
    let refactoredResponse;
    if (resultHandler) {
      refactoredResponse = resultHandler(response);
    } else {
      refactoredResponse = response;
    }
    if (editHandler) {
      editHandler(refactoredResponse);
    } else {
      return refactoredResponse;
    }
  } catch (error) {
    return "something went wrong please try again.";
  }
};

const getRegexByType = (type: "code" | "explanation") => {
  const codeSnippetRegex = /```([\s\S]*?)```/g;
  const explanationRegex = /--Start--([\s\S]*?)--End--/g;
  return type === "code" ? codeSnippetRegex : explanationRegex;
};
const joinSnippets = (
  regexToTest: RegExp,
  text: string,
  type: "code" | "explanation" | "json"
) => {
  let textSnippets = ``;
  let match;
  let i = 1;
  while ((match = regexToTest.exec(text)) !== null) {
    const textSnippet = match[1].trim();

    textSnippets +=
      (type === "code" ? `//code suggestion ${i}:` : "") + type === "json"
        ? textSnippet
        : `\n ${textSnippet}\n\n`;
    if (type === "code") {
      i += 1;
    }
  }
  vscode.window.showInformationMessage(textSnippets);
  return type === "code"
    ? textSnippets
    : type === "explanation"
    ? `/*\n${textSnippets}\n*/`
    : textSnippets;
};
const extractJsonCode = (text: string, hasPrevResponse: boolean) => {
  const startIndex = text.indexOf(
    hasPrevResponse ? "--Continuation--" : "--Start--"
  );
  if (startIndex === -1) {
    return;
  }
  let snippetToAdd;
  if (text.includes("--End--")) {
    snippetToAdd = text.slice(
      startIndex + (hasPrevResponse ? 16 : 9),
      text.indexOf("--End--")
    );
  } else {
    snippetToAdd = text.slice(startIndex + (hasPrevResponse ? 16 : 9));
  }
  return snippetToAdd;
};
const extractCodeSnippets = (text: string) => {
  const regexToTest = getRegexByType("code");
  const snippetToAdd = joinSnippets(regexToTest, text, "code");
  return snippetToAdd;
};
const extractExplanationSnippets = (text: string) => {
  const regexToTest = getRegexByType("explanation");
  const snippetToAdd = joinSnippets(regexToTest, text, "explanation");
  return snippetToAdd;
};

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

const writeAboveSelection = async (textToAdd: string) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No open editor found");
    return;
  }
  const selection = editor?.selection;
  const newPosition = new vscode.Position(selection?.start?.line as number, 0);

  editor?.edit((editBuilder) => {
    if (!newPosition) {
      vscode.window.showErrorMessage("can't find your cursor, try again.");
      return;
    }
    editBuilder.insert(newPosition, `${textToAdd}\n\n`);
  });
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

export const refactorCode = async () => {
  // Get the active text editor

  const selection = getCodeSelectionText();
  // Use Bard for code analysis and refactoring suggestions
  await getBardResponse({
    prompt: `Analyze the code and provide me with two best alternative optimized implementations of the same without any errors and proper comments in note: always return code in markdown" ${selection}`,
    resultHandler: extractCodeSnippets,
    editHandler: replaceInEditor,
  });
  // Replace the selected code with the desired text
};

export const explainCode = async () => {
  const selection = getCodeSelectionText();

  await getBardResponse({
    prompt:
      `Analyze the code and provide me the reply in format of
    --Start--
    Quick Summary:<your quick summary here as paragraph only>
    --End--
    --Start--
    Issues And Improvements:<your quick summary here as paragraph only>
    --End--
     --Start--
     Refactored Code:<code>
     --End--
    caution:make sure you add --start-- at start and separate each section with --End--
` + selection,
    resultHandler: extractExplanationSnippets,
    editHandler: writeAboveSelection,
  });
};

export const askQuestions = async (prompt?: string) => {
  let userDescriptionOrQuery: string | undefined;
  if (!prompt) {
    userDescriptionOrQuery = await vscode.window.showInputBox({
      title: "Ask me anything",
      placeHolder: "Enter any question you have and get instant answers",
    });
  }
  if (!prompt && !userDescriptionOrQuery) {
    return {
      message: "Invalid prompt or description please try again.",
    };
  } else {
    const response = await getBardResponse({
      prompt: (prompt as string) || (userDescriptionOrQuery as string),
    });
    return { message: response };
  }
};
export const performOperationOnCodeSelection = async () => {
  const userDescriptionOrQuery = await vscode.window.showInputBox({
    title: "Action to perform on selected code",
    placeHolder: "Example: migrate the selected code to python",
  });
  if (!userDescriptionOrQuery) {
    vscode.window.showErrorMessage(
      "Enter valid action to perform on selected code."
    );
    return;
  }
  const selection = getCodeSelectionText();
  if (!selection) {
    vscode.window.showErrorMessage(
      "select some code to perform action you requested."
    );
    return;
  }
  await getBardResponse({
    prompt: `perform the following action on code.
    action to perform: ${userDescriptionOrQuery}
    code: ${selection} and return the response like
    --Start--
    Modifications:<the modification you done>
    ---End--
    --Start--
    Modified code:<the modified code here>
    --End--
    or after performing the action or if there is any issue with performing the action i asked for return a section
    --Start--
    Error:<Your short description of issue here>
    --End--`,
    resultHandler: extractExplanationSnippets,
    editHandler: replaceInEditor,
  });
};

export const createProjects = async () => {
  const projectName = await vscode.window.showInputBox({
    title: "project name",
    placeHolder: "Enter project name here",
  });
  if (!projectName) {
    vscode.window.showErrorMessage("Enter valid project name to proceed.");
    return;
  }
  const projectDescription = await vscode.window.showInputBox({
    title: "project Description",
    placeHolder: "Enter project Description here",
    prompt: `Enter description for project:${projectName}`,
  });
  if (!projectDescription) {
    vscode.window.showErrorMessage(
      "Enter valid project description to proceed."
    );
    return;
  }
  const projectTechnologies = await vscode.window.showInputBox({
    title: "project tech stack",
    placeHolder: "Enter project tech stack here",
  });
  if (!projectTechnologies) {
    vscode.window.showErrorMessage(
      "Enter valid project tech stack to proceed."
    );
    return;
  }
  await processSteps({
    steps: [
      {
        stepId: 1,
        actionsToPerform: [
          {
            type: "command",
            command: "mkdir test",
          },
        ],
      },
      {
        stepId: 2,
        actionsToPerform: [
          {
            type: "command",
            command: "cd test",
          },
        ],
      },
      {
        stepId: 3,
        actionsToPerform: [
          {
            type: "command",
            command: "npm init",
          },
        ],
      },
      {
        stepId: 4,
        actionsToPerform: [
          {
            type: "command",
            command:
              "npm install --save react react-dom redux redux-thunk firebase material-ui",
          },
        ],
      },
      {
        stepId: 5,
        actionsToPerform: [
          {
            type: "createFile",
            fileName: "index.js",
            filePath: "./",
            fileContent: `
import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { applyMiddleware } from "redux-thunk";
import reducers from "./reducers";

const store = createStore(reducers, applyMiddleware(thunk));

const App = () => (
  <div>
    <h1>Todo App</h1>
    <TodoList />
  </div>
);

const TodoList = ({ todos }) => (
  <ul>
    {todos.map((todo) => (
      <li key={todo.id}>
        {todo.text}
      </li>
    ))}
  </ul>
);

const rootElement = document.getElementById("root");
ReactDOM.render(<Provider store={store}><App /></Provider>, rootElement);
`,
          },
        ],
      },
      {
        stepId: 6,
        actionsToPerform: [
          {
            type: "createFile",
            fileName: "reducers.js",
            filePath: "./",
            fileContent: `
import { combineReducers } from "redux";

const todosReducer = (state = [], action) => {
  switch (action.type) {
    case "ADD_TODO":
      return [...state, action.todo];
    default:
      return state;
  }
};

const rootReducer = combineReducers({
  todos: todosReducer
});

export default rootReducer;
`,
          },
        ],
      },
      {
        stepId: 7,
        actionsToPerform: [
          {
            type: "createFile",
            actionsToPerform: [
              {
                type: "command",
                command: "npm run start",
              },
            ],
          },
        ],
      },
    ],
  });
  const conversationId = randomUUID();
  await getBardResponse({
    conversationId,
    prompt: `Provide me a step by step process to create project with name ${projectName} using tech stack ${projectTechnologies} and here is the description you can consider while creating the project i.e ${projectDescription}. as i only understand valid json objects please respond in json code block format mentioned below and Instructions to follow without exception are 1.Following the below format is mandatory, 2.provide a valid json every time i.e it is important to only send steps till it makes a proper json cause i only understand valid json in the response and the format i need you to follow for this entire conversation is like the following 
    --Start--
    {
      "steps":[{
        "stepId":<step number here>,
        "actionsToPerform":[{
          "type":"command",
          "command":"command to execute"
        },{
          "type":"createFile",
          "fileName":"name of the file to create",
          "filePath":"file path where the file needs to be created",
          "fileContent":"code to fill in the file here"
        },{
          "type":"updateFile",
          "fileName":"name of the file to update",
          "filePath":"file path where the file needs to be updated",
          "fileUpdateStartLine":"Line number in the file to start updating it from".
          "fileContent":"code to fill in the file here"
        }]
      }],
    }
    --End--
    `,
    extractJson: true,
  });
};
