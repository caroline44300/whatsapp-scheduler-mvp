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
        } else if (time === "custom") {
            showSchedulerModal(message);
        } else {
            alert(`Message scheduled for: ${time}`);
        }

        document.getElementById("wa-scheduler-menu").hidden = true;
    };
  });
}

waitForSendButton();

function showSchedulerModal(message) {
  if (document.getElementById("wa-scheduler-modal")) return; // prevent duplicates

  const modal = document.createElement("div");
  modal.id = "wa-scheduler-modal";
  modal.innerHTML = `
    <div class="wa-modal-backdrop"></div>
    <div class="wa-modal-content">
      <h2>Schedule message</h2>
      <p style="margin-top: -10px; color: #888;">Guadalajara, Mexico City, Monterrey</p>
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
      alert(`Scheduled: ${message} at ${date} ${time}`);
      modal.remove();
      // send to your backend/n8n here
    } else {
      alert("Please select date and time.");
    }
  };
}

