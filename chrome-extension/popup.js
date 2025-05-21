document.getElementById("schedulerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    recipient: document.getElementById("name").value,
    message: document.getElementById("message").value,
    send_time: document.getElementById("send_time").value
  };

  await fetch("http://localhost:8080/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Message scheduled!");
});
