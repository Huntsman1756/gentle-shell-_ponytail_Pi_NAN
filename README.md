# Pi + Gentle Shell + Ponytail + NaN — stack project-local

Plantilla lista para copiar en cualquier proyecto: [Pi](https://pi.dev) (harness de
agente) + [Gentle Shell](https://github.com/Gentleman-Programming/gentle-pi)
(paquete npm `gentle-pi`) + [Ponytail](https://github.com/DietrichGebert/ponytail)
+ el cluster de modelos de [NaN Builders](https://nan.builders/docs/pi),
**con el runtime de Gentle Agents aislado por proyecto** (`.pi/`), sin mover la configuración global de Pi
ni dejar la API key en ningún archivo.

---

## 1. Requisitos

| Pieza | Versión | Notas |
|---|---|---|
| Node.js + npm | cualquier LTS reciente | Pi se instala por npm |
| Pi | `>= 0.85.1` | `npm i -g @earendil-works/pi-coding-agent@latest` — gentle-pi 3.7 lo exige |
| Cuenta NaN | — | API key (`sk-...`) desde https://cloud.nan.builders |

## 2. Quickstart

### Opción A — una línea (no hace falta clonar)

**Windows (PowerShell):**
```powershell
cd <tu-proyecto>
irm https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.ps1 | iex
```

**macOS / Linux / Git Bash:**
```bash
cd <tu-proyecto>
curl -fsSL https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.sh | bash
```

El script copia `.pi/` al proyecto y añade las entradas de runtime al `.gitignore`.

### Opción B — manual

```bash
git clone https://github.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN.git
cp -r gentle-shell-_ponytail_Pi_NAN/.pi <tu-proyecto>/
```

### 3. La API key (una vez por máquina)

El provider lee la key de la variable de entorno `NAN_BUILDERS_API_KEY`
(interpolación `$ENV_VAR` de Pi — la key **nunca** está en el repo).

**Windows (persistente):**
```powershell
setx NAN_BUILDERS_API_KEY "sk-tu-key"
# abre una terminal NUEVA después de setx
```

**bash/zsh (persistente):**
```bash
echo 'export NAN_BUILDERS_API_KEY="sk-tu-key"' >> ~/.bashrc   # o ~/.zshrc
```

**Solo esta sesión:** `$env:NAN_BUILDERS_API_KEY="sk-..."` (PowerShell) o
`export NAN_BUILDERS_API_KEY="sk-..."` (bash).

### 4. Primer arranque

```bash
cd <tu-proyecto>
pi
```

1. Pi detecta `.pi/` y pide **project trust** una vez (Enter para confiar).
2. Tras el trust, Pi **instala automáticamente** los paquetes declarados en
   `.pi/settings.json` (`gentle-pi` + `ponytail`) bajo `.pi/npm/`.
3. Si tu npm tiene política `allow-scripts`, el postinstall de `gentle-pi`
   quedará bloqueado. Ejecútalo a mano una vez (instala el binario nativo
   `gentle-ai` que usan las reviews):
   ```bash
   node .pi/npm/node_modules/gentle-pi/scripts/install-gentle-ai.mjs
   ```
4. Smoke test:
   ```bash
   pi -p "responde solo: READY"
   ```

---

## 5. Qué contiene la plantilla

```
.pi/
├── settings.json                # paquetes Pi + defaultProvider/defaultModel
├── extensions/
│   └── nan-provider.ts          # registra el provider "nan" leyendo
│                                #   $NAN_BUILDERS_API_KEY (sin secretos)
└── npm/.gitignore               # ignora los paquetes instalados
```

| Archivo | Qué hace |
|---|---|
| `.pi/settings.json` | Declara `npm:gentle-pi` y `npm:@dietrichgebert/ponytail` como paquetes **de proyecto**; fija `defaultProvider: "nan"` y `defaultModel: "glm5.3-flash"`. Se puede commitear (no contiene secretos). |
| `.pi/extensions/project-isolation.js` | Antes de cargar `gentle-pi`, fija `GENTLE_PI_AGENT_HOME` a `.pi/gentle-agent-home/`. Así `orchestrator_list`/`orchestrator_send_message` solo descubren sesiones del mismo proyecto. No cambia `PI_CODING_AGENT_DIR`, por lo que auth/settings/packages de Pi siguen siendo globales. |
| `.pi/extensions/nan-provider.ts` | `pi.registerProvider("nan", {...})` con `baseUrl: https://api.nan.builders/v1`, `api: "openai-completions"` y los 7 modelos del cluster. Se carga solo tras project-trust. |
| `.pi/npm/` | Lo crea Pi al instalar. Está gitignored; no se copia entre proyectos (Pi lo regenera). |

> ¿Por qué una extensión y no `models.json`? Pi solo lee `models.json` del
> directorio global `~/.pi/agent/` — no existe `models.json` por proyecto.
> La extensión de proyecto es el mecanismo oficial para declarar providers
> con alcance local (`.pi/extensions/`). Si prefieres NaN **global** para
> todos tus proyectos, copia el bloque de provider a `~/.pi/agent/models.json`
> siguiendo https://nan.builders/docs/pi.

## 6. Modelos NaN disponibles

| id | Uso recomendado | Contexto | Notas |
|---|---|---|---|
| `glm5.3-flash` | **coding** (default aquí) | 1M | MIT, cuota 2B tokens/mes |
| `deepseek-v4-flash` | uso general, mayor cuota | 1M | visión, reasoning adaptativo |
| `qwen3.8-flash` | ligero/multimodal | 262K | tool calling XML |
| `mimo-v2.6-flash` | omnimodal | 1M | audio no llega desde Pi |
| `gemma4` | ligero | 262K | reasoning ajustable |
| `qwen3.6` | legado | 262K | mantenido por compatibilidad |
| `glm5.3` | premium | 1M | requiere tier premium → `401` sin él |

Cambiar de modelo dentro de Pi: `/model` (o `pi --model nan/deepseek-v4-flash`).
Cambiar el default: edita `defaultModel` en `.pi/settings.json` o
`/model` → Ctrl+S.


## 7. Aislamiento entre proyectos

`gentle-pi` publica las sesiones de `orchestrator_*` dentro de su `GENTLE_PI_AGENT_HOME`. Si se deja el valor por defecto (`~/.pi/agent`), dos terminales abiertas en repositorios distintos comparten el mismo registro local y pueden descubrirse entre sí.

La plantilla evita ese cruce mediante `.pi/extensions/project-isolation.js`, que se carga antes que las extensiones de paquetes y fija:

```text
GENTLE_PI_AGENT_HOME=<project>/.pi/gentle-agent-home
```

Solo se aísla Gentle Agents. `PI_CODING_AGENT_DIR` no se modifica, por lo que las credenciales, paquetes y settings normales de Pi conservan su ubicación habitual. En el primer uso se copian, sin sobrescribir archivos locales existentes, las definiciones globales de `agents/`, `subagents/` y `subagents.json` para no perder los agentes ya disponibles.

El runtime aislado está en `.gitignore`. Para permitir deliberadamente descubrimiento entre proyectos, arranca Pi con `PI_NAN_ALLOW_SHARED_GENTLE_HOME=1`.

Comprobación recomendada: abre Pi en dos repositorios distintos que usen esta plantilla y ejecuta `orchestrator_list` en ambos. Cada uno debe dejar de anunciar la sesión del otro. Cierra primero las sesiones antiguas que se iniciaron con el perfil global.

## 8. Cómo conviven Gentle Shell y Ponytail

Ambos inyectan texto al system prompt en `before_agent_start` de forma
**aditiva** — no se sobrescriben, pero conviene tener clara la precedencia:

1. **Las reglas del proyecto** (`AGENTS.md` del repo, si existe) mandan sobre
   gates, tests y forma de trabajo.
2. **Ponytail** aplica su filosofía "lazy senior dev" (diff mínimo, reusar
   antes de escribir, sin abstracciones no pedidas). Modo por defecto: `full`.
   - `/ponytail off|lite|full|ultra` cambia el modo de la sesión.
   - `/ponytail status` muestra el modo; `/ponytail default <modo>` fija el
     default **global** (`%APPDATA%\ponytail\config.json` o
     `~/.config/ponytail/config.json`; también `PONYTAIL_DEFAULT_MODE`).
   - Escribir "normal mode" / "stop ponytail" lo desactiva en la sesión.
   - Skills: `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`,
     `/ponytail-gain`, `/ponytail-help`.
3. **Gentle Shell** aporta la UI, la persona Gentleman, el workflow ODD
   (SDD/OpenSpec solo si lo pides explícitamente), los **subagentes nativos**
   `gentle-agents` y el binario `gentle-ai` para reviews.

**No instales `pi-subagents-j0k3r`**: gentle-pi ≥ 3.x ya trae subagentes
nativos con los mismos tool names — instalarlo duplicaría las tools.

## 9. Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `401` | sin `defaultProvider`/`defaultModel`, key ausente o modelo premium | revisa `.pi/settings.json`, `echo $env:NAN_BUILDERS_API_KEY`, evita `glm5.3` sin tier |
| "Project is not trusted" | primer uso de `.pi/` en esa carpeta | acepta el prompt de trust, o `pi --approve` en modo no interactivo |
| reviews nativas fallan (`package-local-binary-missing`) | postinstall de gentle-pi bloqueado por npm | `node .pi/npm/node_modules/gentle-pi/scripts/install-gentle-ai.mjs` |
| `pi auth check --provider nan` dice `not_ready` | normal: no hay credencial *guardada*, la key vive en el env var | ignorar; la prueba real es `pi -p "..."` |
| `mimo-v2.6-flash` no "oye" audio | Pi solo declara inputs `text`/`image` | limitación conocida, el audio va por API directa |
| respuestas cortadas | `maxTokens` es el techo de salida (incluye reasoning) | el reasoning consume ese presupuesto |
| Windows: el env var "no existe" en Pi | `setx` solo aplica a terminales **nuevas** | abre otra terminal / `refreshenv` |
| dos proyectos aparecen en `orchestrator_list` | instalación antigua sin aislamiento o `PI_NAN_ALLOW_SHARED_GENTLE_HOME=1` | actualiza la `.pi/` del proyecto, cierra las sesiones antiguas y vuelve a abrir `pi` |

## 10. Actualizar

```bash
pi update --all            # paquetes + pi
pi update npm:gentle-pi    # un paquete concreto
```

Las versiones en `settings.json` van sin pin (`npm:gentle-pi` = última). Para
congelar: `npm:gentle-pi@3.7.0`, `npm:@dietrichgebert/ponytail@4.10.0` —
las specs pineadas no se actualizan con `pi update`.

## 11. Seguridad

- Nunca commitees la API key. La plantilla usa `$NAN_BUILDERS_API_KEY`;
  verifica con `git diff --cached` antes de commitear `.pi/` en un proyecto.
- Las extensiones de proyecto ejecutan código local tras el trust — revisa
  `.pi/extensions/` antes de confiar una carpeta.
- `pi auth check` / `pi auth print-api-key` existen para depurar credenciales;
  no pegues su salida en issues o commits.

## 12. Reutilizar en otro proyecto — resumen

```text
1. npm i -g @earendil-works/pi-coding-agent@latest   (si hace falta)
2. setx NAN_BUILDERS_API_KEY "sk-..."                (una vez por máquina)
3. cd proyecto && irm .../install.ps1 | iex          (o copia .pi/ a mano)
4. pi  →  aceptar trust  →  packages se instalan solos
5. node .pi/npm/node_modules/gentle-pi/scripts/install-gentle-ai.mjs
   (solo si npm bloqueó el postinstall)
6. pi -p "READY"                                     (smoke test)
```

---

Stack probado con Pi 0.87.1, gentle-pi 3.7.0, ponytail 4.10.0 (2026-09).
