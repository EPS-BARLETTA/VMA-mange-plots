<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Course — Mange Plots</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"/>
<link rel="stylesheet" href="./app.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/noSleep/0.12.0/NoSleep.min.js"></script>
<style>
  /* Pastilles visibles par défaut (fallback) */
  .pacer-dot {
    width: 28px; height: 28px; border-radius: 9999px;
    border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.15);
    position: absolute; top: -10px; transform: translateX(-50%);
    pointer-events: none; user-select: none;
  }
  .pacer-rabbit-dot { background:#3b82f6; } /* bleu */
  .pacer-runner-dot { background:#22c55e; } /* vert */
  .pacer-img { display:none; } /* les PNG ne s’affichent que si onload OK */
</style>
</head>
<body class="runnerA course0">
  <header class="max-w-6xl mx-auto p-4 flex justify-between items-center border-b-2">
    <a href="./index.html" class="btn btn-ghost">Accueil</a>
    <div></div>
  </header>

  <main class="max-w-6xl mx-auto p-4 space-y-4">
    <h1 class="text-3xl font-extrabold text-center">Course en direct</h1>

    <!-- Carte chrono / sous-barre -->
    <section class="card">
      <div class="text-center">
        <div id="runnerName" class="mb-2">
          <span class="firstname text-4xl font-extrabold leading-tight">—</span>
          <span class="lastname sr-only"></span>
        </div>

        <div id="timer" class="timer text-7xl font-extrabold">00:00</div>

        <div class="subbar mt-4">
          <div id="subFill" class="fill"></div>
        </div>

        <div class="mt-2 text-base">
          <span class="inline-block px-3 py-1 rounded-full bg-green-100 text-gray-900 font-bold border border-green-200">
            <span id="subLeft">01:30</span> restant
          </span>
          <span class="ml-2 text-gray-700">
            Cible : <span id="targetPlots">—</span> plots / 1:30
          </span>
        </div>
      </div>
    </section>

    <!-- Lièvre vs Coureur -->
    <section class="card">
      <div class="text-center space-y-3 max-w-3xl mx-auto">
        <div class="flex items-center justify-center gap-3 text-sm">
          <label for="togglePacer" class="font-semibold">Activer le lièvre</label>
          <input id="togglePacer" type="checkbox" class="w-5 h-5" checked>
        </div>

        <h2 class="text-xl font-extrabold">Lièvre (projet) vs Coureur</h2>

        <!-- Barre globale : overflow-visible + un peu plus haute -->
        <div id="pacerWrap" class="mx-auto" style="max-width:720px">
          <div id="pacerBar" class="relative h-6 rounded-full bg-gray-200 overflow-visible">
            <div id="pacerTrack" class="absolute inset-0"></div>

            <!-- Pastilles par défaut -->
            <div id="pacerRabbitDot" class="pacer-dot pacer-rabbit-dot" style="left:0%"></div>
            <div id="pacerRunnerDot" class="pacer-dot pacer-runner-dot" style="left:0%"></div>

            <!-- Images (affichées si chargent) -->
            <img id="pacerRabbitIcon" alt="Lièvre"
                 class="pacer-img absolute -top-5 w-8 h-8 transform -translate-x-1/2 select-none pointer-events-none drop-shadow"
                 style="left:0%" />
            <img id="pacerRunnerIcon" alt="Coureur"
                 class="pacer-img absolute -top-5 w-8 h-8 transform -translate-x-1/2 select-none pointer-events-none drop-shadow"
                 style="left:0%" />
          </div>
        </div>

        <!-- Légende -->
        <div class="mt-1 text-sm text-gray-800 space-x-2">
          <span>Attendu total : <b><span id="pacerTotal">—</span></b> plots</span>
          <span>• Lièvre : <b><span id="pacerRabbitNow">—</span></b></span>
          <span>• Coureur : <b><span id="pacerRunnerNow">—</span></b></span>
          <span>• Écart cumul : <b><span id="pacerDelta">—</span></b> plots (<span id="pacerDeltaM">—</span> m)</span>
        </div>
      </div>
    </section>

    <!-- Compteur plots -->
    <section id="counterPanel" class="counter-panel">
      <div class="grid grid-cols-3 gap-4 items-center max-w-sm mx-auto">
        <button id="btnMinus" class="counter-btn bg-red-100 text-gray-900 rounded-xl text-2xl">➖</button>
        <div class="text-center">
          <div class="text-sm mb-1">Plots (sous-bloc)</div>
          <div id="counter" class="text-6xl font-extrabold">0</div>
        </div>
        <button id="btnPlus" class="counter-btn bg-green-100 text-gray-900 rounded-xl text-2xl">➕</button>
      </div>
    </section>

    <section class="flex justify-center gap-3">
      <button id="btnStart" class="btn btn-primary text-lg px-6">Démarrer</button>
    </section>

    <!-- Fin de course : pas d’auto-avance -->
    <section id="afterCourse" class="hidden flex justify-center gap-3">
      <button id="nextCourse" class="btn btn-primary">Passer à la course suivante</button>
    </section>
  </main>

  <footer class="text-center py-6 border-t-2">
    <div>Mange Plots — Équipe EPS Lycée Vauban — LUXEMBOURG — JB</div>
  </footer>

  <script src="./app.js"></script>
  <script src="./run.js"></script>
</body>
</html>
