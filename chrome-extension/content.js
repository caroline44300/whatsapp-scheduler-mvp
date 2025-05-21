function waitForSendButton() {
  const interval = setInterval(() => {
    const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button');
    if (sendButton && !document.querySelector("#wa-scheduler-dropdown")) {
      clearInterval(interval);
      injectDropdown(sendButton);
    }
  }, 1000);
}

function injectDropdown(sendButton) {
  const dropdown = document.createElement("div");
  dropdown.id = "wa-scheduler-dropdown";
  dropdown.innerHTML = `
    <button id="wa-scheduler-toggle">🕒</button>
    <div id="wa-scheduler-menu" hidden>
      <div class="wa-scheduler-option" data-time="now">Send now</div>
      <div class="wa-scheduler-option" data-time="tomorrow">Tomorrow 9am</div>
      <div class="wa-scheduler-option" data-time="custom">Custom time</div>
    </div>
  `;
  sendButton.parentNode.insertBefore(dropdown, sendButton.nextSibling);

  // Toggle dropdown
  document.getElementById("wa-scheduler-toggle").onclick = () => {
    const menu = document.getElementById("wa-scheduler-menu");
    menu.hidden = !menu.hidden;
  };

  // Handle options
  document.querySelectorAll(".wa-scheduler-option").forEach(option => {
    option.onclick = () => {
      const time = option.getAttribute("data-time");
      const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');
      const message = messageBox?.innerText;
      if (!message) return;

      if (time === "now") {
        document.querySelector('span[data-icon="send"]').closest('button').click();
      } else {
        alert(`Message scheduled for: ${time}`);
        // Here you’d send a message to your background script or n8n logic
      }

      document.getElementById("wa-scheduler-menu").hidden = true;
    };
  });
}

waitForSendButton();
