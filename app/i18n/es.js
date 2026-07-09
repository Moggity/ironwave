/* ============================================================
   IRONWAVE — i18n/es.js
   Catálogo en español. Copiado de en.js: se traducen solo los
   VALORES, nunca las claves; los marcadores tipo {name} se dejan
   intactos. Ver README.md en esta carpeta.
   ============================================================ */

'use strict';

const I18N_ES = {
  // --- shared units and small words ---
  'unit.rir': '{n} RIR',
  'unit.kg': 'kg',
  'unit.kg_hand': 'kg/mano',

  // --- confirm dialog defaults ---
  'confirm.title': 'Confirmar',
  'confirm.ok': 'Confirmar',
  'confirm.cancel': 'Cancelar',

  // --- session view ---
  'session.week_day': 'Semana {week}, Día {day}',
  'session.short_sleep': 'Dormiste poco anoche ({hours}h). Las series marcadas ⚠ traen más riesgo de fatiga. Saltarlas hoy es inteligente, no debilidad.',
  'session.todays_focus': 'Enfoque de hoy',
  'session.finish_workout': 'Terminar entrenamiento',
  'session.readiness_title': 'Preparación diaria',
  'session.last_set': 'Última serie',
  'session.optional_tag': 'opcional',
  'session.over_time_limit': 'Excede tu límite de tiempo. Hazlo si te queda tiempo, si no sáltalo.',
  'session.sets_x_reps': '{sets} series x {reps} reps',
  'session.notes': 'Notas',
  'session.notes_placeholder': 'Notas de la sesión…',
  'session.warmup': 'Calentamiento',
  'session.skipped': 'Saltada',
  'session.performance': 'Registrar',
  'session.log': 'Anotar',
  'session.short_sleep_flag': '⚠ opcional hoy, dormiste poco',
  'session.superset': 'Superserie',
  'session.giant_set': 'Serie gigante',
  'session.superset_how': 'Una serie de cada uno en orden, luego descansa. Repite cada ronda.',
  'session.round': 'Ronda {n}',
  'session.member_done': 'listo',
  'session.leave_title': '¿Salir de esta sesión?',
  'session.leave_message': 'Tus series registradas quedan guardadas en el borrador, así puedes retomar esta sesión.',
  'session.leave_confirm': 'Salir de la sesión',
  'session.calibration_hint': 'Calibración: calcula el peso a ojo y ve subiendo. Lo que registres aquí define tus pesos futuros.',
  'session.swap_exercise': 'Cambiar ejercicio',

  // --- readiness lift labels ---
  'lift.squat': 'Sentadilla',
  'lift.bench': 'Press banca',
  'lift.deadlift': 'Peso muerto',
  'lift.upperpull': 'Tirón superior',
  'lift.press': 'Press militar',
  'lift.lowback': 'Zona lumbar',

  // --- set target labels ---
  'set.amrap_standard': 'estándar {reps}',
  'set.cap_at': 'tope en {rir}',
  'set.then': 'luego {detail}',
  'set.reps_at_rir': '{reps} reps @ {rir}',

  // --- RIR intro card (one-time) ---
  'rir.intro_title': 'Nuevo: el esfuerzo se registra como RIR',
  'rir.intro_body': 'RIR son las repeticiones en reserva, la otra cara del RPE. Menos RIR significa más cerca del fallo, y 0 es darlo todo. Tus pesos e historial no cambiaron, solo la forma de decirlo.',
  'rir.got_it': 'Entendido',

  // --- intensity techniques (finishers) ---
  'tech.straight': 'Serie normal',
  'tech.drop': 'Serie descendente',
  'tech.myo': 'Myo-reps',
  'tech.restpause': 'Descanso-pausa',
  'tech.partials': 'Parciales en estiramiento',
  'tech.superset': 'Superserie',
  'tech.chip_drop': 'Descendente',
  'tech.chip_myo': 'Myo-reps',
  'tech.chip_restpause': 'Descanso-pausa',
  'tech.chip_partials': 'Parciales',
  'tech.drop_how': 'Serie descendente añadida. Haz tu última serie, luego quita peso y sigue',
  'tech.myo_how': 'Myo-reps añadidas. Haz la serie de activación, luego mini-descansos cortos y mini-series',
  'tech.restpause_how': 'Descanso-pausa añadido. Llega al fallo, pausa y saca unas cuantas más',
  'tech.partials_how': 'Parciales añadidos. Tras tu última rep completa, sigue con reps parciales en el estiramiento',
  'tech.removed': '{name}: quitado',
  'tech.need_weight': 'Primero define un peso de trabajo',
  'tech.add_finisher': 'Añade un remate',
  'tech.optional_last_set': 'opcional, última serie',
  'tech.runs_on_set': 'Va en la serie {n}: haz la serie hasta su tope de RIR tal como está escrita, lo que se acerca al fallo es el {tech} de después.',
  'tech.what_is': '¿Qué es un remate?',
  'tech.info_title': 'Remates',
  'tech.info_intro': 'Un remate extiende tu <b>última serie de trabajo</b> de un ejercicio. Haz esa serie tal como está escrita y para en su tope de RIR, no la lleves al fallo. El remate de después es lo que acerca el músculo al fallo, con una fracción de la fatiga de más series normales.',
  'tech.info_drop': 'Termina la serie, baja al peso más ligero indicado y sigue sin descanso. Registra las reps de cada bajada en su propia fila de mini-serie.',
  'tech.info_myo': 'Termina la serie, descansa unos 20 segundos y haz mini-series cortas con el mismo peso. Repite hasta que las reps de la mini-serie caigan. Registra las reps de cada mini-serie.',
  'tech.info_restpause': 'Termina la serie, pausa unos 15 segundos y saca unas cuantas reps más con el mismo peso. Registra las reps extra en las filas de mini-serie.',
  'tech.info_partials': 'Tras tu última rep completa, sigue con reps parciales en la mitad estirada del movimiento. Cuenta solo las reps completas en el total de la serie, juzga tu RIR sobre las reps completas antes de empezar los parciales, y registra las reps parciales en su propia fila.',
  'tech.info_logging': 'Registro: apunta primero el peso, las reps y el RIR de la serie, como si hubieras parado ahí. Las filas de mini-serie de abajo son para las reps del remate.',
  'tech.word_drop': 'bajadas',
  'tech.word_myo': 'myo',
  'tech.word_restpause': 'descanso-pausa',
  'tech.word_partials': 'parciales',
  'tech.child_drop_title': 'Bajadas',
  'tech.child_drop_hint': 'quita peso y sigue, registra reps',
  'tech.child_myo_title': 'Mini-series',
  'tech.child_myo_hint': 'mismo peso, mini-descansos cortos, registra reps',
  'tech.child_restpause_title': 'Ráfagas',
  'tech.child_restpause_hint': 'mismo peso, pausa y sigue, registra reps',
  'tech.child_partials_title': 'Parciales',
  'tech.child_partials_hint': 'mismo peso, reps parciales en el estiramiento, registra reps',

  // --- rest timer ---
  'rest.label': 'Descanso',
  'rest.done': 'Descanso listo',
  'rest.skip': 'Saltar',
  'rest.done_btn': 'Listo',
  'rest.notify_body': 'Descanso listo. Siguiente serie.',
  'rest.alerts_on': 'Avisos de descanso activados',
  'rest.alerts_off': 'Avisos de descanso desactivados',
  'rest.notify_unavailable': 'Las notificaciones no están disponibles aquí. En iPhone, instala primero la app: Compartir, luego Añadir a pantalla de inicio',
  'rest.notify_blocked': 'Las notificaciones están bloqueadas. Permítelas para IRONWAVE en los ajustes de tu dispositivo',

  // --- performance modal ---
  'perf.title': 'Registrar serie',
  'perf.weight': 'Peso',
  'perf.added_weight': 'Peso añadido',
  'perf.bw_note': 'Ejercicio de peso corporal. Cuenta solo el peso que añades (chaleco, cinturón, mancuerna). Deja 0 si es solo peso corporal.',
  'perf.reps': 'Reps',
  'perf.rir_label': 'Reps en reserva (RIR)',
  'perf.rir_hint': 'RIR es cuántas reps podrías hacer todavía. 0 es darlo todo.',
  'perf.pump': 'Congestión',
  'perf.optional': 'opcional',
  'perf.clear': 'BORRAR',
  'perf.skip': 'SALTAR',
  'perf.done': 'HECHO',
  'perf.skip_hint': 'Saltar deja la serie sin nada registrado. Cardio, una molestia, sin energía hoy, todas son razones válidas.',
  'perf.pause': 'Pausa',
  'perf.minirest': 'Mini-descanso',
  'perf.go_again': 'Otra vez',
  'perf.big_jump_title': 'Salto de peso enorme',
  'perf.big_jump_msg': 'Estás registrando {new} en {name}, muy por encima de tu mejor {best}. Un despiste común es escribir tu peso corporal en un ejercicio de peso corporal, donde solo cuenta la carga añadida. Los pesos futuros se prescriben a partir de lo que registres.',
  'perf.big_jump_confirm': 'Regístralo, es real',
  'perf.big_jump_cancel': 'Volver',
  'perf.wm_up': '{name}: máximo de trabajo {from} → {to} kg',
  'perf.wm_capped': '(tope de +10 reps)',
  'perf.amrap_variation': 'AMRAP registrado. Ejercicio de variación, el máximo de trabajo no cambia',
  'perf.wm_calibrated': '{name}: máximo de trabajo calibrado a {w} kg',
  'perf.calibrated_next': '{name} calibrado. Los pesos se prescriben desde tu próxima sesión',
  'perf.superset_next': 'Siguiente: {name}. Superserie, descansa al final de la ronda',
  'perf.set_skipped': 'Serie saltada, nada registrado',

  // --- loading / plate math ---
  'plates.configure': 'Configurar discos ›',
  'plates.bar_only': 'solo la barra',
  'plates.closest': 'carga más cercana: {w}kg',
  'plates.note': '(barra de {bar}kg + {plates}kg)',
  'load.machine': 'carga en máquina',
  'load.added': 'carga añadida',
  'load.per_hand': '{half} kg por mano, {total} kg en total',
  'load.dumbbell': 'mancuerna de {w} kg',

  // --- pump quick-tap ---
  'pump.1': 'Ligera',
  'pump.2': 'Buena',
  'pump.3': 'Brutal',
  'pump.generic': 'congestión',

  // --- RIR/RPE effort descriptions (perf modal) ---
  'rpe.10': 'No podía hacer ni una rep más',
  'rpe.9.5': 'Quizá podía hacer 1 rep más',
  'rpe.9': 'Podía hacer 1 rep más',
  'rpe.8.5': 'Podía hacer 1, quizá 2 reps más',
  'rpe.8': 'Podía hacer 2 reps más',
  'rpe.7.5': 'Podía hacer 2, quizá 3 reps más',
  'rpe.7': 'Podía hacer 3 reps más con confianza',
  'rpe.6.5': 'Podía hacer 3, quizá 4 reps más',
  'rpe.6': 'Podía hacer 4 reps más',
  'rpe.5.5': 'Podía hacer 4, quizá 5 reps más',
  'rpe.5': 'Podía hacer 5+ reps más, se sintió como calentamiento',

  // --- warmup modal ---
  'warmup.title': 'Calentamiento',
  'warmup.target_top': 'Serie objetivo',
  'warmup.bar_weight': 'Peso de la barra',
  'warmup.hint': 'Construye base en el calentamiento. Barra rápida, descansos cortos.',

  // --- session rating + finish ---
  'sr.title': 'Valoración de la sesión',
  'sr.question': '¿Qué tan dura fue la sesión?',
  'sr.low': '5 · CALENTAMIENTO',
  'sr.high': '10 · LA MÁS DURA',
  'sr.5': 'Se sintió como calentamiento',
  'sr.6': 'Dura pero cómoda',
  'sr.7': 'Trabajo sólido',
  'sr.8': 'Muy exigente',
  'sr.9': 'Brutal',
  'sr.10': 'La sesión más dura de tu vida',
  'sr.complete': 'Completar sesión',
  'sr.none_title': '¿Terminar sin series?',
  'sr.none_msg': 'No has registrado ninguna serie en esta sesión. Puedes terminarla igualmente.',
  'sr.none_confirm': 'Terminar igualmente',
  'sr.saved': 'Sesión guardada, {tonnage} kg de tonelaje total',

  // --- settings: language ---
  'settings.language': 'Idioma',
  'settings.language_auto': 'Automático (idioma del dispositivo)',
  'settings.language_hint': 'Se aplica al momento. Lo que aún no está traducido se muestra en inglés.',
  'settings.language_saved': 'Idioma actualizado',
};

I18N.register('es', 'Español', I18N_ES);
