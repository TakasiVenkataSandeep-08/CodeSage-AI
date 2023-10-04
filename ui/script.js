(function () {
  let converter;
  let currentActiveChatId = "";
  let currentActiveChatData = "";
  let isActionInProgress = false;
  let globalApiKey = "";

  const vscode = acquireVsCodeApi();

  const chatsHistory = document.getElementById("chatsHistory");
  const chatContainer = document.getElementById("chatContainer");
  const historyChatsWrapper = document.getElementById("historyChatsWrapper");
  const chatMessages = document.getElementById("chatMessages");
  const chatInputWrapper = document.getElementById("chatInputWrapper");
  const messageInput = document.getElementById("messageInput");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const sendButton = document.getElementById("sendButton");
  const saveButton = document.getElementById("saveButton");

  messageInput.addEventListener("input", () => {
    messageInput.style.height = "0px";
    messageInput.style.height = messageInput.scrollHeight + "px";
  });

  function handleShowProgressbar() {
    isActionInProgress = true;
    const progressBarWrapper = document.createElement("div");

    const progressText = document.createElement("p");
    progressText.innerText = "Please wait while codesage does it's magic.";
    progressText.classList.add("progressText");

    const progressBar = document.createElement("div");
    progressBar.classList.add("progressBar");
    const progress = document.createElement("div");
    progress.classList.add("progress");
    progressBar.appendChild(progress);

    progressBarWrapper.appendChild(progressText);
    progressBarWrapper.appendChild(progressBar);

    chatMessages.appendChild(progressBarWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function handleHideProgressbar() {
    isActionInProgress = false;
    chatMessages.removeChild(chatMessages.lastChild);
  }

  function handleGetHtmlFromText(text) {
    if (!converter) {
      converter = new showdown.Converter({
        omitExtraWLInCodeBlocks: true,
        simplifiedAutoLink: true,
        excludeTrailingPunctuationFromURLs: true,
        literalMidWordUnderscores: true,
        simpleLineBreaks: true,
      });
    }
    try {
      const htmlResponse = converter.makeHtml(text);
      return htmlResponse;
    } catch (error) {
      return "Something went wrong please try again.";
    }
  }
  const focusInput = () => {
    messageInput.focus();
  };

  //Adding focus for input on open
  focusInput();

  const handleShowChatInputWrapper = (value) => {
    chatInputWrapper.style.display = value;
  };

  const handleShowApiKeyViewWrapper = (value) => {
    apiKeyViewWrapper.style.display = value;
  };

  const handleShowChatsHistory = (value) => {
    chatsHistory.style.display = value;
  };
  const handleShowChatContainer = (value) => {
    chatContainer.style.display = value;
  };

  const handleClearHistoryView = () => {
    historyChatsWrapper.textContent = null;
  };

  const toggleDisableInputAndSend = (isDisabled) => {
    messageInput.disabled = isDisabled;
    sendButton.disabled = isDisabled;
  };

  function handleSendMessageToEditor(type, value) {
    if (isActionInProgress) {
      return;
    }
    if (type === "prompt") {
      handleShowProgressbar();
    }
    vscode.postMessage({
      type,
      value,
    });
  }

  const goBackToPreviousChat = () => {
    handleClearHistoryView();
    handleShowChatsHistory("none");
    handleShowChatContainer("flex");
  };

  function handlePreAndCodeBlocks(htmlContent) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const preCodeBlocks = tempDiv.querySelectorAll("pre code");
    for (let index = 0; index < preCodeBlocks.length; index++) {
      preCodeBlocks[index].parentElement.classList.add("pre-code");
      // Create the buttons
      const replaceButton = document.createElement("button");
      replaceButton.textContent = "Replace";
      const addButton = document.createElement("button");
      addButton.textContent = "Add";
      const copyButton = document.createElement("button");
      copyButton.textContent = "Copy";

      // Add the buttons to a container div
      var buttonContainer = document.createElement("div");
      buttonContainer.classList.add("code-buttons");
      buttonContainer.appendChild(replaceButton);
      buttonContainer.appendChild(addButton);
      buttonContainer.appendChild(copyButton);

      // Add the container div above the code block
      preCodeBlocks[index].parentNode.parentNode.insertBefore(
        buttonContainer,
        preCodeBlocks[index].parentNode
      );

      const codeContent = preCodeBlocks[index].textContent;

      // Add a click event handler to the replace button
      replaceButton.addEventListener("click", (e) => {
        e.preventDefault();
        handleSendMessageToEditor("replaceCode", codeContent);
      });

      // Add a click event handler to the add button
      addButton.addEventListener("click", (e) => {
        e.preventDefault();
        handleSendMessageToEditor("addCode", codeContent);
      });

      // Add a click event handler to the copy button
      copyButton.addEventListener("click", (e) => {
        e.preventDefault();
        handleSendMessageToEditor("copyCode", codeContent);
      });
    }
    return tempDiv;
  }

  // Function to add a user message to the chat
  function addUserMessage(message) {
    const userMessage = document.createElement("div");
    userMessage.classList.add("user-message");

    const messagePrefix = document.createElement("span");
    messagePrefix.classList.add("message-prefix");
    messagePrefix.textContent = "User: ";

    const messageText = document.createElement("span");
    messageText.textContent = message;

    userMessage.appendChild(messagePrefix);
    userMessage.appendChild(messageText);

    chatMessages.appendChild(userMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    toggleDisableInputAndSend(true);
  }

  // Function to add a bot message to the chat
  function addBotMessage(response) {
    const botMessage = document.createElement("div");
    botMessage.classList.add("bot-message");

    const messagePrefix = document.createElement("span");
    messagePrefix.classList.add("message-prefix");
    messagePrefix.textContent = "CodeSage AI: ";

    const messageText = handlePreAndCodeBlocks(response);

    botMessage.appendChild(messagePrefix);
    botMessage.appendChild(messageText);

    chatMessages.appendChild(botMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    toggleDisableInputAndSend(false);
    focusInput();
  }

  function handleShowCustomPrompts(customPrompts) {
    const chatPromptWrapper = document.getElementById("chatPromptWrapper");
    Object.keys(customPrompts).forEach((customPromptId) => {
      const customPromptData = customPrompts[customPromptId];
      const promptCard = document.createElement("div");
      promptCard.textContent = customPromptData.title;
      promptCard.classList.add("promptCard");
      chatPromptWrapper.appendChild(promptCard);
      promptCard.addEventListener("click", () => {
        if (!currentActiveChatId) {
          handleSendMessageToEditor(
            "showErrorMessage",
            "No active chat found, please create one."
          );
          return;
        }
        let payload = {
          chatId: currentActiveChatId,
          customPromptData: { ...customPromptData, id: customPromptId },
        };
        if (
          currentActiveChatData &&
          currentActiveChatData.messages &&
          currentActiveChatData.messages.length
        ) {
          payload.chatMessages = currentActiveChatData.messages;
        }
        handleSendMessageToEditor("prompt", payload);
        if (currentActiveChatData) {
          currentActiveChatData = "";
        }
      });
    });
  }

  function handleOpenEmptyScreen(customPrompts) {
    handleShowChatInputWrapper("none");
    handleShowCustomPrompts(customPrompts);
    handleShowChatContainer("flex");
  }

  function handleResumeOldChat({ chatId, currentChatData, customPrompts }) {
    handleShowChatContainer("flex");
    if (chatsHistory.style.display === "flex") {
      handleClearHistoryView();
      handleShowChatsHistory("none");
    }
    if (customPrompts) {
      handleShowCustomPrompts(customPrompts);
    }
    currentActiveChatId = chatId;
    currentActiveChatData = currentChatData;
    chatTitle.textContent = `${
      currentChatData.title.length > 25
        ? currentChatData.title.substring(0, 25) + "..."
        : currentChatData.title
    }`;
    chatMessages.textContent = null;
    currentChatData.messages.forEach((messageData) => {
      if (messageData.type === "user") {
        addUserMessage(messageData.message);
      } else {
        const htmlResponse = handleGetHtmlFromText(messageData.message);
        addBotMessage(htmlResponse);
      }
    });
    if (chatInputWrapper.style.display === "none") {
      handleShowChatInputWrapper("flex");
    }
  }

  function handleCreateNewChat(chatData) {
    currentActiveChatId = chatData.chatId;
    chatMessages.textContent = null;
    const chatTitle = document.getElementById("chatTitle");
    chatTitle.textContent = `${
      chatData.title.length > 25
        ? chatData.title.substring(0, 25) + "..."
        : chatData.title
    }`;
    handleShowChatInputWrapper("flex");
  }

  function handleShowHistoryTab(allChatsData) {
    handleSendMessageToEditor("log", allChatsData);
    handleShowChatContainer("none");
    handleShowChatsHistory("flex");
    for (const chatId in allChatsData) {
      const chatData = allChatsData[chatId];
      const chatCard = document.createElement("div");
      chatCard.classList.add("chatCard");
      chatCard.textContent = chatData.title;
      chatCard.addEventListener("click", () => {
        if (chatId === currentActiveChatId) {
          goBackToPreviousChat();
          return;
        }
        handleSendMessageToEditor("resumeOldChat", { chatId });
      });
      historyChatsWrapper.appendChild(chatCard);
    }
  }

  function handleShowApiKeyButton(value) {
    apiKeyBtn.style.display = value;
  }

  function handleShowApiKeyScreen() {
    handleShowApiKeyButton("none");
    handleShowChatContainer("none");
    handleShowChatsHistory("none");
    handleShowApiKeyViewWrapper("flex");
  }

  function handleCloseChatApiScreen() {
    handleShowApiKeyViewWrapper("none");
    handleShowChatContainer("flex");
    handleShowApiKeyButton("block");
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "closeApiKeyScreen": {
        const { apiKey } = message.value;
        globalApiKey = apiKey;
        handleCloseChatApiScreen();
        break;
      }
      case "openApiKeyScreen": {
        handleShowApiKeyScreen();
        break;
      }
      case "openEmptyScreen": {
        const { customPrompts } = message.value;
        handleOpenEmptyScreen(customPrompts);
        break;
      }
      case "resumeOldChat": {
        handleResumeOldChat(message.value);
        break;
      }
      case "stopLoading": {
        if (isActionInProgress) {
          handleHideProgressbar();
        }
        break;
      }
      case "addUserMessage": {
        if (isActionInProgress) {
          handleHideProgressbar();
        }
        addUserMessage(message.value.message);
        break;
      }
      case "addBotMessage": {
        let response = message.value.message;
        const htmlResponse = handleGetHtmlFromText(response);
        if (isActionInProgress) {
          handleHideProgressbar();
        }
        addBotMessage(htmlResponse);
        break;
      }
      case "createNewChat": {
        const { currentChatData } = message.value;
        handleCreateNewChat(currentChatData);
        break;
      }
      case "openHistory": {
        const { allChatsData } = message.value;
        handleShowHistoryTab(allChatsData);
        break;
      }
      case "clearResponse": {
        addBotMessage("");
        break;
      }
      case "setPrompt": {
        messageInput.value = message.value;
        break;
      }
    }
  });

  // Event listener for sending a message
  sendButton.addEventListener("click", () => {
    if (!currentActiveChatId) {
      handleSendMessageToEditor(
        "showErrorMessage",
        "No active chat found, please create one."
      );
      return;
    }
    const message = messageInput.value.trim();
    if (message) {
      addUserMessage(message);
      messageInput.value = "";
      const payload = {
        chatId: currentActiveChatId,
        message,
      };
      if (
        currentActiveChatData &&
        currentActiveChatData.messages &&
        currentActiveChatData.messages.length
      ) {
        payload.chatMessages = currentActiveChatData.messages;
      }
      handleSendMessageToEditor("prompt", payload);
      if (currentActiveChatData) {
        currentActiveChatData = "";
      }
    }
  });

  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      apiKeyInput.value = "";

      handleSendMessageToEditor("saveApiKey", { apiKey });
    }
  });

  // Event listener for pressing Enter key to send a message
  messageInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      sendButton.click();
    }
  });

  apiKeyInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      saveButton.click();
    }
  });

  const newChatButton = document.getElementById("newChatButton");
  newChatButton.addEventListener("click", () => {
    handleSendMessageToEditor("newChat");
  });

  const historyButton = document.getElementById("historyButton");
  historyButton.addEventListener("click", () => {
    handleSendMessageToEditor("openHistory");
  });

  const apiKeyBtn = document.getElementById("apiKeyBtn");
  apiKeyBtn.addEventListener("click", () => {
    apiKeyInput.value = globalApiKey;
    handleShowApiKeyScreen();
  });

  const cancelButton = document.getElementById("cancelButton");
  cancelButton.addEventListener("click", () => {
    handleCloseChatApiScreen();
  });

  const backButton = document.getElementById("backButton");
  backButton.addEventListener("click", () => {
    goBackToPreviousChat();
  });

  const initialiseChat = () => {
    handleShowChatsHistory("none");
    handleShowApiKeyViewWrapper("none");
    handleShowChatContainer("none");
    handleSendMessageToEditor("openLastChat");
  };
  initialiseChat();
})();
