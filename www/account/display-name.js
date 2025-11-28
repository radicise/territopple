document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("display-name");
  const button = document.getElementById("display-submit");
  const msg = document.getElementById("msg");

  button.addEventListener("click", async () => {
    const name = input.value;

    if (!name) {
      msg.textContent = "Please enter a display name.";
      return;
    }

    msg.textContent = "Updating...";

    try {
      const res = await fetch("/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: name }),
      });

      if (res.ok) {
        msg.textContent = "Display name updated successfully!";
      } else {
        const text = await res.text();
        msg.textContent = "Error: " + text;
      }
    } catch (e) {
      console.error(e);
      msg.textContent = "Network error. Try again.";
    }
  });
});
