document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const user = document.getElementById("user").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!user || !password) {
        alert("Please enter your user and password.");
        return;
    }

    // Más adelante validamos contra backend.
    // Por ahora, siempre entra al dashboard master:
    window.location.href = "dashboard.html";
});
