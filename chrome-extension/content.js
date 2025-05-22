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
  const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');

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
      const message = messageBox.innerText.trim();
      const name    = document.querySelector("header span[dir='auto']").innerText.trim();
      const type    = option.getAttribute("data-time");
      if (!message) return;

      if (type === "now") {
        sendButton.click();
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

  const messageBox = document.querySelector('[contenteditable="true"][data-tab="10"]');


  const modal = document.createElement("div");
  modal.id = "wa-scheduler-modal";
  modal.innerHTML = `
    <div class="wa-modal-backdrop"></div>
    <div class="wa-modal-content">
      <h2>Schedule message</h2>
      <div class="wa-modal-inputs">
        <label>
          Contact number <span class="wa-required">*</span><br/>
          <select id="wa-number-select">
            <option value="" disabled selected hidden>
              Select contact phone number
            </option>
          </select>
        </label>
        <label>
          Date <span class="wa-required">*</span><br/>
          <input type="text" id="wa-date" placeholder="Pick a date" readonly />
        </label>
        <label>
          Time <span class="wa-required">*</span><br/>
          <input type="text" id="wa-time" placeholder="Pick a time" readonly />
        </label>
      </div>
      <div class="wa-modal-actions">
        <button id="wa-cancel">Cancel</button>
        <button id="wa-confirm">Schedule Message</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  flatpickr("#wa-date", {
  dateFormat: "Y-m-d",
  defaultDate: new Date()
  });

  flatpickr("#wa-time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    defaultDate:   new Date(Date.now() + 60*60*1000),  // now +1h
  });

  document.getElementById("wa-cancel").onclick = () => modal.remove();

  // 1) Fetch all numbers for this name
  fetch(`http://localhost:8080/api/contacts?name=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(({ numbers }) => {
      const select = document.getElementById("wa-number-select");
      select.innerHTML = ""; // clear previous

      if (numbers.length > 1) {
        // multiple: populate dropdown as before
        numbers.forEach(n => {
          const opt = document.createElement("option");
          opt.value = n;
          opt.textContent = n;
          select.appendChild(opt);
        });
        // leave it enabled so user can pick
        select.disabled = false;

      } else if (numbers.length === 1) {
        // exactly one: auto-select & disable dropdown
        const only = numbers[0];
        select.innerHTML = `<option value="${only}">${only}</option>`;
        select.value = only;
        select.disabled = true;
      } else {
        // no numbers: fall back to name
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
        select.disabled = true;
      }
    })
    .catch(e => {
      console.error("Could not fetch contacts:", e);
      // fallback: disable and show name
      const select = document.getElementById("wa-number-select");
      select.innerHTML = `<option>${name}</option>`;
      select.disabled = true;
    });

  document.getElementById("wa-confirm").onclick = () => {
    const date = document.getElementById("wa-date").value;
    const time = document.getElementById("wa-time").value;
    if (!date || !time) {
      alert("Please select both a date and a time.");
      return;
    }

    // 2) grab which phone they picked
    const selectedNumber = document.getElementById("wa-number-select").value;
    const iso = new Date(`${date}T${time}`).toISOString();
    const payload = {
      name:      name,
      number:    selectedNumber,
      message:   message,
      send_time: iso,
    };

    fetch("http://localhost:8080/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(({ success }) => {
      if (success) {
        const reallyDismiss = !window.confirm(
          `✅ "${message}" scheduled for ${name} (${selectedNumber})\non ${new Date(iso).toLocaleString()}\n\nPress OK to dismiss, or Cancel to keep this dialog open.`
        );
        if (reallyDismiss) {
          return; // user hit “Cancel” – leave modal open
        }
        // user hit “OK” – cleanup & close
        document.getElementById("wa-date").value = "";
        document.getElementById("wa-time").value = "";
        document.getElementById("wa-scheduler-menu").hidden = true;
        // re-grab and clear the actual WhatsApp input
        const liveMessageSpan = document.querySelector('span.selectable-text.copyable-text.false');
        if (liveMessageSpan) {
          const editor = liveMessageSpan.closest('div[contenteditable="true"]');
          if (editor) editor.innerHTML = '';
        }
        // now tear down the modal
        modal.remove();
      } else {
        window.alert("❌ Scheduling failed");
      }
    })
    .catch(e => window.alert("❌ " + e));
  };
}

// Kick off
waitForSendButton();
