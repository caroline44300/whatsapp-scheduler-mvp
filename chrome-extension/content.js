function waitForSendButton() {
  setInterval(() => {
    const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button');
    const messageInput = document.querySelector('[contenteditable="true"][data-tab="10"]');

    if (sendButton && messageInput) {
      setupMessageObserver(messageInput, sendButton);
    }
  }, 1000);
}


let activeObserver = null;

function setupMessageObserver(input, sendButton) {
  // Disconnect previous observer if any
  if (activeObserver) {
    activeObserver.disconnect();
  }

  activeObserver = new MutationObserver(() => {
    const hasText = input.innerText.trim().length > 0;
    const existing = document.querySelector("#wa-scheduler-dropdown");

    if (hasText && !existing) {
      injectDropdown(sendButton);
    } else if (!hasText && existing) {
      existing.remove();
    }
  });

  activeObserver.observe(input, {
    childList: true,
    subtree: true,
    characterData: true
  });
}


function injectDropdown(sendButton, attempt = 0) {
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 500;

  if (!sendButton || !sendButton.parentNode) {
    if (attempt < MAX_RETRIES) {
      console.warn(`Retrying injectDropdown (${attempt + 1})...`);
      setTimeout(() => {
        const refreshedButton = document.querySelector('span[data-icon="send"]')?.closest('button');
        injectDropdown(refreshedButton, attempt + 1);
      }, RETRY_DELAY);
    } else {
      console.error("Failed to inject dropdown after max retries.");
    }
    return;
  }

  if (document.querySelector("#wa-scheduler-dropdown")) return;

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

  try {
    sendButton.parentNode.insertBefore(dropdown, sendButton.nextSibling);
  } catch (err) {
    console.error("Dropdown injection failed:", err);
  }

  document.getElementById("wa-scheduler-toggle").onclick = () => {
    const menu = document.getElementById("wa-scheduler-menu");
    menu.hidden = !menu.hidden;
  };

  document.querySelectorAll(".wa-scheduler-option").forEach(option => {
    // inside injectDropdown() where you handle the “Tomorrow” button:
    option.onclick = () => {
      const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');
      const message = messageBox.innerText.trim();
      const name    = document.querySelector("header span[dir='auto']").innerText.trim();
      const type    = option.getAttribute("data-time");
      if (!message) return;

      if (type === "now") {
        sendButton.click();
        messageBox.innerText = "";
      } else if (type === "tomorrow") {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        t.setHours(9, 0, 0, 0);

        // ** NEW: POST to scheduler **
        fetch("http://localhost:8080/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:      name,
            message:   message,
            send_time: t.toISOString()
          })
        })
        .then(r => r.json())
        .then(({ success }) => {
          if (success) alert(`✅ Scheduled for ${t.toLocaleString()}`);
          else         alert(`❌ Scheduling failed`);
        })
        .catch(e => alert("Error: "+e));

        messageBox.innerText = "";
      } else {
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
    if (!date || !time) {
      alert("Please select both a date and a time.");
      return;
    }

    const iso = new Date(`${date}T${time}`).toISOString();
    const payload = { name, message, send_time: iso };

    // ** NEW: POST to scheduler **
    fetch("http://localhost:8080/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(({ success }) => {
      if (success) {
        const local = new Date(iso).toLocaleString();
        alert(`✅ Scheduled for ${local}`);
      } else {
        alert("❌ Scheduling failed");
      }
    })
    .catch(e => alert("Error: "+e));

    modal.remove();
    document.querySelector('[contenteditable="true"][data-tab="10"]').innerText = "";
  };
}

// Kick off
waitForSendButton();
