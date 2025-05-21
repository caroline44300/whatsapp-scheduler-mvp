function waitForSendButton() {
  const interval = setInterval(() => {
    const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button');
    const messageInput = document.querySelector('[contenteditable="true"][data-tab="10"]');

    if (sendButton && messageInput) {
      setupMessageObserver(messageInput, sendButton);
      clearInterval(interval);
    }
  }, 1000);
}

function setupMessageObserver(input, sendButton) {
  const observer = new MutationObserver(() => {
    const hasText = input.innerText.trim().length > 0;
    const existing = document.querySelector("#wa-scheduler-dropdown");

    if (hasText && !existing) {
      injectDropdown(sendButton);
    } else if (!hasText && existing) {
      existing.remove();
    }
  });

  observer.observe(input, { childList: true, subtree: true, characterData: true });
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

  document.getElementById("wa-scheduler-toggle").onclick = () => {
    const menu = document.getElementById("wa-scheduler-menu");
    menu.hidden = !menu.hidden;
  };

  document.querySelectorAll(".wa-scheduler-option").forEach(option => {
    option.onclick = () => {
      const type = option.getAttribute("data-time");
      const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');
      const message = messageBox?.innerText.trim();
      const name = document.querySelector("header span[title]")?.getAttribute("title") || "Unknown";

      if (!message) return;

      if (type === "now") {
        document.querySelector('span[data-icon="send"]').closest('button').click();
        messageBox.innerText = "";
      } else if (type === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const payload = {
          name,
          message,
          send_time: tomorrow.toISOString()
        };
        console.log("Scheduled Message:", payload);
        alert(`Message to ${name} scheduled for: ${payload.send_time}`);
        messageBox.innerText = "";
      } else if (type === "custom") {
        showSchedulerModal(name, message);
      }

      document.getElementById("wa-scheduler-menu").hidden = true;
    };
  });
}

function showSchedulerModal(name, message) {
  if (document.getElementById("wa-scheduler-modal")) return;

  const modal = document.createElement("div");
  modal.id = "wa-scheduler-modal";
  modal.innerHTML = `
    <div class="wa-modal-backdrop"></div>
    <div class="wa-modal-content">
      <h2>Schedule message</h2>
      <div class="wa-modal-inputs">
        <input type="date" id="wa-date" />
        <input type="time" id="wa-time" />
      </div>
      <div class="wa-modal-actions">
        <button id="wa-cancel">Cancel</button>
        <button id="wa-confirm">Schedule Message</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("wa-cancel").onclick = () => modal.remove();

  document.getElementById("wa-confirm").onclick = () => {
    const date = document.getElementById("wa-date").value;
    const time = document.getElementById("wa-time").value;

    if (date && time) {
      const iso = new Date(`${date}T${time}`).toISOString();
      const payload = {
        name,
        message,
        send_time: iso
      };
      console.log("Scheduled Message:", payload);
      alert(`Message to ${name} scheduled for: ${iso}`);
      modal.remove();

      const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');
      if (messageBox) messageBox.innerText = "";
    } else {
      alert("Please select both a date and a time.");
    }
  };
}

// Kick off
waitForSendButton();
