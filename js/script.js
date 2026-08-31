/* =====================================================================
 * Pokédex — lista, buscador, carga por tandas y ficha de detalle
 * ===================================================================== */

/* --- Referencias a elementos del HTML ---
   Se buscan una sola vez, al arrancar, y se reutilizan siempre. */
const tarjetaPokemon = document.getElementById("pokemon");
const tarjetaData = document.getElementById("pokemon__data");
const search = document.getElementById("search");
const buttonLoader = document.getElementById("loader__button");
const buttonFilterByTypes = document.getElementById("filter__by__types");
const buttonfilterByFav = document.getElementById("buttonfilterByFav");
const buttonMute = document.getElementById("buttonMute");


/* =====================================================================
 * ESTADO
 * ---------------------------------------------------------------------
 * Todo lo que la aplicación "recuerda" entre una acción y otra.
 * Regla: un dato, una variable. Nada que se pueda calcular a partir
 * de estas se guarda aparte — se calcula en el momento.
 * ===================================================================== */

let allPokemons = [];        // los Pokémon ya descargados (la "despensa")
let allPokemonsType = []     // los tipos de cada pokemon
let offset = 0;              // por dónde va la paginación (el marcapáginas)
let hayMas = true;           // ¿quedan más tandas en la API?
let cargando = false;        // ¿hay una petición en curso ahora mismo?
let terminoBusqueda = "";    // lo que el usuario tiene escrito en el buscador
let filterType = []          // el filtro que el usuario tiene activo (maximo 2)
let soloFavoritos = false;   // esta activo el filtro por favoritos?
let moreDetails = false;     // se presiono el switch de mas detalles dentro del modal?

/* El rugido que esta sonando AHORA. Empieza en null porque al arrancar
   no suena nada. Guardamos el objeto Audio entero, no un true/false:
   para parar algo no basta con saber que existe, hay que poder cogerlo. */
let sonidoActual = null;

const favs = "like"          // clave del favoritos en localStorage
const MUTE = "mute"          // clave del silencio en localStorage



const POR_TANDA = 20;       // la cantidad de pokemons que se cargaran

const URL_ARTWORK =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

const URL_CRIES =
    "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest";

/* =====================================================================
 * Funciones que construyen HTML
 * ===================================================================== */

/* Recibe el array de tipos de un Pokémon y devuelve sus pastillas
   ya unidas en un solo texto, listo para insertar. */
function createElementalTypeHTML(types) {
    const pastillas = types.map((tipo) => {
        const nombre = tipo.type.name;
        return `<span data-type="${nombre}">${nombre}</span>`;
    });

    return pastillas.join("");
}

/* Recibe UN Pokémon y devuelve el HTML de su tarjeta. */
function createTarjetaHTML(pokemon) {
    const img = `${URL_ARTWORK}/${pokemon.id}.png`;
    const esFavorito = likes.includes(`${pokemon.id}`);

    /* El segundo tipo puede no existir: si no lo hay, repetimos el
       primero para que el degradado quede en color plano. */
    const type1 = pokemon.types[0].type.name;
    const type2 = pokemon.types[1] ? pokemon.types[1].type.name : type1;

    return /*HTML*/`
        <article class="pokemon--container" data-type-1="${type1}" data-type-2="${type2}">
            <button class="pokemon--button--detalles" data-id="${pokemon.id}">
                <img src="${img}" alt="Imagen de ${pokemon.name}" loading="lazy">

                <span class="pokemon--detalles">
                    <span class="pokemon--id">#${pokemon.id}</span>
                    <span class="pokemon--name">${pokemon.name}</span>
                    <span class="pokemon--type">${createElementalTypeHTML(pokemon.types)}</span>
                </span>
            </button>
            <button data-name="${pokemon.name}" type="button" data-id="${pokemon.id}" class="favorito" aria-label="${esFavorito ? "Quitar de" : "Añadir a"} ${pokemon.name} favoritos" aria-pressed="${esFavorito}">
                <svg class="favorito__icono" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
        </article>
    `;
}

/* Recibe la lista plana de evoluciones y el id del que se esta viendo.
   Devuelve la fila de eslabones. El actual NO es pulsable: no tiene
   sentido navegar hacia donde ya estas. */
function createEvolutionHTML(evoluciones, idActual) {
    /* Una cadena de un solo eslabon significa que no evoluciona. */
    if (!evoluciones || evoluciones.length <= 1) {
        return `<p class="evolucion__vacio">Este Pokémon no evoluciona.</p>`;
    }

    const pasos = evoluciones.map((evolucion) => {
        /* Number() en los dos lados: el id de la cadena y el de la ficha
           pueden venir uno como numero y otro como texto. */
        const esActual = Number(evolucion.id) === Number(idActual);

        /* alt vacio a proposito: el nombre esta escrito justo al lado,
           y repetirlo obliga al lector de pantalla a decirlo dos veces. */
        const contenido = /*HTML*/`
            <img src="${URL_ARTWORK}/${evolucion.id}.png" alt="" loading="lazy">
            <span class="evolucion__nombre">${evolucion.name}</span>
        `;

        if (esActual) {
            return /*HTML*/`
                <li class="evolucion__paso">
                    <span class="evolucion__eslabon es-actual" aria-current="true">
                        ${contenido}
                    </span>
                </li>
            `;
        }

        return /*HTML*/`
            <li class="evolucion__paso">
                <button
                    class="evolucion__eslabon"
                    type="button"
                    data-evo-id="${evolucion.id}"
                    aria-label="Ver la ficha de ${evolucion.name}">
                    ${contenido}
                </button>
            </li>
        `;
    });

    /* <ol> y no <ul>: en una cadena evolutiva el orden es el dato. */
    return `<ol class="evolucion">${pasos.join("")}</ol>`;
}


/* Panel de la columna izquierda: sustituye a la foto cuando el usuario
   pasa al modo Pokedex. Ese hueco es alto y estrecho, asi que la cadena
   se dibuja en vertical, con la flecha apuntando hacia abajo. */
function createPanelEvolucionHTML(evoluciones, idActual) {
    return /*HTML*/`
        <div class="modal__panel panel--evolucion" id="panel__evolucion" hidden>
            <h3>Evoluciones</h3>
            ${createEvolutionHTML(evoluciones, idActual)}
        </div>
    `;
}


/* Panel 2 completo. Recibe UN objeto con todo lo que necesita, en vez
   de cinco parametros sueltos: asi el orden al llamarla da igual y se
   lee que es cada cosa. Nace con hidden porque la ficha siempre se
   abre por las estadisticas. */
function createPanelPokedexHTML(datos) {
    const {
        descripcion, categoria, habitat, generacion,
        gruposHuevo, capturaRate, felicidad, rareza, habilidades
    } = datos;

    /* Solo los legendarios y singulares llevan distintivo. El resto no
       recibe un hueco vacio: directamente no se pinta el elemento. */
    const distintivo = rareza
        ? `<p class="pokedex__rareza">${rareza}</p>`
        : "";

    /* Las habilidades se pintan como pastillas, igual que los tipos.
       La oculta lleva su propia marca con un atributo que lee el CSS. */
    const pastillasHabilidades = (habilidades || [])
        .map((habilidad) => `
            <li class="habilidad" ${habilidad.oculta ? "data-oculta=\"true\"" : ""}>
                ${habilidad.name}
            </li>
        `)
        .join("");

    return /*HTML*/`
        <div class="modal__panel" id="panel__pokedex" hidden>

            <h3>Descripción</h3>
            ${distintivo}
            <p class="pokedex__texto">${descripcion || "Descripción no disponible."}</p>

            <h3>Habilidades</h3>
            ${
                pastillasHabilidades
                    ? `<ul class="pokedex__habilidades">${pastillasHabilidades}</ul>`
                    : `<p class="pokedex__vacio">Sin datos de habilidades.</p>`
            }

            <h3>Datos</h3>
            <dl class="pokedex__datos">
                <div>
                    <dt>Categoría</dt>
                    <dd>${categoria || "—"}</dd>
                </div>
                <div>
                    <dt>Hábitat</dt>
                    <dd>${habitat || "—"}</dd>
                </div>
                <div>
                    <dt>Generación</dt>
                    <dd>${generacion || "—"}</dd>
                </div>
                <div>
                    <dt>Grupos huevo</dt>
                    <dd>${gruposHuevo || "—"}</dd>
                </div>
                <div>
                    <dt>Ratio captura</dt>
                    <dd>${capturaRate ?? "—"}</dd>
                </div>
                <div>
                    <dt>Felicidad base</dt>
                    <dd>${felicidad ?? "—"}</dd>
                </div>
            </dl>

        </div>
    `;
}


/* species trae la MISMA descripcion repetida para cada videojuego y
   cada idioma. .find() devuelve el primer elemento que cumple la
   condicion (o undefined). Buscamos espanol; si este Pokemon no lo
   tiene, caemos al ingles antes de rendirnos. */
function getDescripcion(species) {
    const entradas = species.flavor_text_entries || [];

    const entrada =
        entradas.find((e) => e.language.name === "es") ||
        entradas.find((e) => e.language.name === "en");

    if (!entrada) return "";

    /* Estos textos vienen de cartuchos de Game Boy: llevan saltos de
       linea (\n) y de pagina (\f) metidos a mano para que cupieran en
       la pantalla. Los cambiamos por espacios y quitamos los dobles. */
    return entrada.flavor_text
        .replace(/[\n\f\r]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/* La categoria ("Pokemon Raton"). Mismo criterio de idioma. */
function getCategoria(species) {
    const generos = species.genera || [];

    const genero =
        generos.find((g) => g.language.name === "es") ||
        generos.find((g) => g.language.name === "en");

    return genero ? genero.genus : "";
}

/* habitat puede venir a null: hay Pokemon sin habitat asignado. */
function getHabitat(species) {
    return species.habitat ? species.habitat.name : "";
}

/* "generation-i" no es algo que quieras enseñarle a nadie. */
function getGeneracion(species) {
    if (!species.generation) return "";
    return species.generation.name.replace("generation-", "").toUpperCase();
}

/* Los grupos huevo determinan con quien puede criar. Vienen en ingles. */
function getGruposHuevo(species) {
    const grupos = species.egg_groups || [];
    return grupos.map((grupo) => grupo.name).join(", ");
}

/* Legendario y singular son excluyentes en la practica, y la inmensa
   mayoria no es ninguna de las dos: devolvemos cadena vacia y quien
   pinta decide si merece un distintivo. */
function getRareza(species) {
    if (species.is_mythical) return "Singular";
    if (species.is_legendary) return "Legendario";
    return "";
}

/* Las habilidades viven en /pokemon, no en species. La oculta se marca
   aparte porque no se obtiene por metodos normales. */
function getHabilidades(pokemon) {
    const habilidades = pokemon.abilities || [];

    return habilidades.map((entrada) => ({
        name: entrada.ability.name,
        oculta: entrada.is_hidden
    }));
}


function evolutionChain(evolveChain){
    let evolve = [{
        name: evolveChain.species.name ,
        id: Number(evolveChain.species.url.split("/").at(-2))
    }]
 
    evolveChain.evolves_to.forEach((subordinado) => {
        evolve = [...evolve, ...evolutionChain(subordinado)];
    });


    return evolve
}


/* mantenerPanel: al saltar de una evolucion a otra el usuario esta
   navegando DENTRO del modo Pokedex, y sacarlo a las estadisticas seria
   perder el hilo. Abrir una ficha desde la rejilla, en cambio, empieza
   siempre de cero. */
async function createModalWindow(pokemonId, mantenerPanel = false){
    if (!mantenerPanel) {
        moreDetails = false;
    }

    /* --- Estado de carga ---
       Hay dos situaciones muy distintas y antes las tratabamos igual:

       1. El modal esta CERRADO (clic en una tarjeta de la rejilla). No
          hay nada que conservar: se abre con el mensaje de "Cargando".

       2. El modal ya esta ABIERTO (clic en una evolucion). Aqui borrar
          el contenido para poner "Cargando" es justo lo que producia el
          parpadeo: la ficha desaparecia y volvia a aparecer. En vez de
          eso dejamos lo que hay en pantalla y solo lo atenuamos, como
          una pagina que se esta pasando. Cuando llegan los datos, el
          contenido se sustituye de una vez. */
    const yaEstabaAbierto = tarjetaData.open;

    if (yaEstabaAbierto) {
        /* Los data-type se quedan: quitarlos ahora haria parpadear el
           borde degradado antes de saber el tipo del nuevo. */
        tarjetaData.classList.add("modal--cargando");

    } else {
        tarjetaData.removeAttribute("data-type-1");
        tarjetaData.removeAttribute("data-type-2");

        tarjetaData.innerHTML = /*HTML*/`
            <button class="modal__cerrar" type="button">Cerrar</button>
            <p class="modal__mensaje">Cargando…</p>
        `;
        tarjetaData.showModal();
    }

    /* --- Petición: aquí sí puede fallar --- */
    try {
        const dataTarjetaResponsefetch = fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);

        /* El .catch de aqui hace que una caida de red en species no
           tumbe tambien a las estadisticas: en vez de romperse, esta
           promesa entrega null y seguimos adelante. */
        const dataSecondTarjetaResponsefetch =
            fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`).catch(() => null);

        const [dataTarjetaResponse, dataSecondTarjetaResponse] = await Promise.all([
            dataTarjetaResponsefetch,
            dataSecondTarjetaResponsefetch
        ]);

        /* Sin /pokemon no hay ficha que enseñar: esto si es fatal. */
        if (!dataTarjetaResponse.ok) {
            throw new Error(`El servidor respondió con código ${dataTarjetaResponse.status}`);
        }

        const dataTarjeta = await dataTarjetaResponse.json();

        /* --- Datos de enciclopedia: son un extra ---
           Si species o la cadena evolutiva fallan, la ficha tiene que
           seguir viendose igual. Por eso viven en su propio try y
           arrancan vacias: el panel dira "no disponible" y ya esta.
           Errores de distinta gravedad, salidas distintas. */
        let descripcion = "";
        let categoria = "";
        let habitat = "";
        let generacion = "";
        let gruposHuevo = "";
        let capturaRate = null;
        let felicidad = null;
        let rareza = "";
        let evoluciones = [];

        /* Las habilidades vienen de /pokemon, que ya ha llegado seguro:
           por eso viven fuera del try de los extras. */
        const habilidades = getHabilidades(dataTarjeta);

        try {
            if (!dataSecondTarjetaResponse || !dataSecondTarjetaResponse.ok) {
                throw new Error("No se pudo leer pokemon-species");
            }

            const dataSecondTarjeta = await dataSecondTarjetaResponse.json();

            descripcion = getDescripcion(dataSecondTarjeta);
            categoria = getCategoria(dataSecondTarjeta);
            habitat = getHabitat(dataSecondTarjeta);
            generacion = getGeneracion(dataSecondTarjeta);
            gruposHuevo = getGruposHuevo(dataSecondTarjeta);
            rareza = getRareza(dataSecondTarjeta);
            capturaRate = dataSecondTarjeta.capture_rate;
            felicidad = dataSecondTarjeta.base_happiness;

            const dataEvolutionResponse = await fetch(dataSecondTarjeta.evolution_chain.url);

            if (!dataEvolutionResponse.ok) {
                throw new Error(`La cadena evolutiva respondió con código ${dataEvolutionResponse.status}`);
            }

            const dataEvolution = await dataEvolutionResponse.json();
            evoluciones = evolutionChain(dataEvolution.chain);

        } catch (error) {
            /* warn y no error: no es un fallo de la ficha, es un extra
               que no ha llegado. */
            console.warn("Datos de Pokédex no disponibles:", error);
        }

        const img = `${URL_ARTWORK}/${dataTarjeta.id}.png`;
        let statTotal = 0

        const pokemonStats = dataTarjeta.stats.map((pokemonInfo) => {
            statTotal = pokemonInfo.base_stat + statTotal;
            return /*HTML*/`
                <li class="stat">
                    <span class="stat__nombre">${pokemonInfo.stat.name}:</span>
                    <span class="stat__valor">${pokemonInfo.base_stat}</span>
                </li>
            `;
        });

        /* El degradado del borde se dibuja desde CSS leyendo estos
           atributos, igual que en las tarjetas. */
        tarjetaData.setAttribute("data-type-1", dataTarjeta.types[0].type.name);
        tarjetaData.setAttribute(
            "data-type-2",
            dataTarjeta.types[1]
                ? dataTarjeta.types[1].type.name
                : dataTarjeta.types[0].type.name
        );

        /* --- El rugido ---
           1. Si habia uno sonando, se corta. Pausar no rebobina: sin
              poner currentTime a 0, el proximo play() seguiria por
              donde iba. Es una aguja de tocadiscos, hay que levantarla
              Y devolverla al principio.
           2. Guardamos el nuevo en el estado para poder cortarlo la
              proxima vez.
           3. Solo suena si el usuario no ha silenciado. */
        if (sonidoActual) {
            sonidoActual.pause();
            sonidoActual.currentTime = 0;
        }

        sonidoActual = new Audio(`${URL_CRIES}/${pokemonId}.ogg`);
        sonidoActual.volume = 0.2;

        if (!silenciado) {
            /* play() devuelve una promesa que puede fallar (formato no
               soportado, pestana silenciada...). Nunca debe romper la
               ficha: solo avisa en consola. */
            sonidoActual.play().catch((error) => {
                console.log("No se pudo reproducir el sonido", error);
            });
        }

        tarjetaData.innerHTML = /*HTML*/`
            <button class="modal__cerrar" aria-label="Cerrar ventana" type="button">Cerrar</button>

            <div class="modal__grid">

                <div class="modal__img">

                    <!-- La foto y la cadena evolutiva ocupan el MISMO hueco:
                         se turnan segun el panel activo. -->
                    <div class="modal__panel" id="panel__img">
                        <img src="${img}" alt="Imagen de ${dataTarjeta.name}">
                    </div>

                    ${createPanelEvolucionHTML(evoluciones, dataTarjeta.id)}

                    <div class="modal__box">
                        <p class="modal__id pokemon--id">#${dataTarjeta.id}</p>
                        <h2 class="modal__name pokemon--name">${dataTarjeta.name}</h2>
                        <div class="modal__tipos pokemon--type">
                            ${createElementalTypeHTML(dataTarjeta.types)}
                        </div>
                    </div>
                </div>

                <div class="modal__info">

                    <div class="modal__panel" id="panel__stats">

                        <h3>Estadísticas base</h3>

                        <ul class="modal__stats">
                            ${pokemonStats.join("")}
                            <span class="stat__total">Total: ${statTotal}</span>
                        </ul>

                        <dl class="modal__medidas">
                            <div>
                                <dt>Altura: </dt><dd> ${dataTarjeta.height / 10}m</dd>
                            </div>
                            <div>
                                <dt>Peso: </dt><dd> ${dataTarjeta.weight / 10}kg</dd>
                            </div>
                        </dl>

                    </div>

                    ${createPanelPokedexHTML({
                        descripcion,
                        categoria,
                        habitat,
                        generacion,
                        gruposHuevo,
                        capturaRate,
                        felicidad,
                        rareza,
                        habilidades
                    })}

                    <div class="box__switch__button">
                        <button id="switch__buttonID" class="switch__button" aria-label="Ver la descripción y las evoluciones" aria-pressed="false" type="button">
                            <svg class="switch__icono" viewBox="0 0 24 24" aria-hidden="true">
                                <path class="pokeball__tapa" d="M2 12a10 10 0 0 1 20 0z"/>
                                <path class="pokeball__base" d="M22 12a10 10 0 0 1-20 0z"/>
                                <circle class="pokeball__borde" cx="12" cy="12" r="10"/>
                                <path class="pokeball__banda" d="M2 12h6M16 12h6"/>
                                <circle class="pokeball__centro" cx="12" cy="12" r="3.4"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
            </div>
            
        `;

        /* El HTML nace siempre con las estadisticas visibles. Si el
           usuario venia navegando en modo Pokedex, esta llamada corrige
           los cuatro paneles y el boton de golpe, antes de que el
           navegador pinte nada. Una sola fuente de verdad: moreDetails. */
        pintarPaneles(tarjetaData.querySelector(".switch__button"));

        /* Ya hay contenido nuevo: se levanta la atenuacion. */
        tarjetaData.classList.remove("modal--cargando");

    } catch (error) {
        /* Cada estado debe traer su propia salida: sin este botón,
           el usuario quedaría encerrado en el modal. */
        tarjetaData.classList.remove("modal--cargando");

        tarjetaData.innerHTML = /*HTML*/`
            <button class="modal__cerrar" type="button">Cerrar</button>
            <p class="modal__mensaje">
                No hemos podido cargar este Pokémon.
                Comprueba tu conexión e inténtalo de nuevo.
            </p>
        `;
        console.error(error);
    }
}

function cargarFavs() {
    const guardadoFavs = localStorage.getItem(favs);
    return guardadoFavs ? JSON.parse(guardadoFavs) : [];
}
function guardarFavs(like) {
    localStorage.setItem(favs, JSON.stringify(like));
}

/* Mismo patron que los favoritos. Ojo al primer arranque: localStorage
   devuelve null cuando la clave no existe todavia, y null no es "false",
   asi que hay que decidir explicitamente el valor por defecto. */
function cargarSilencio() {
    const guardadoMute = localStorage.getItem(MUTE);
    return guardadoMute ? JSON.parse(guardadoMute) : false;
}
function guardarSilencio(valor) {
    localStorage.setItem(MUTE, JSON.stringify(valor));
}

let likes = cargarFavs();

/* Preferencia del usuario: vive en el estado y ademas en localStorage,
   para que sobreviva a un recargado de pagina. Se inicializa aqui, y no
   arriba, porque necesita que MUTE y la funcion ya existan. */
let silenciado = cargarSilencio();

/* Muestra un mensaje ocupando toda la rejilla (cargando, error, vacío). */
function mostrarMensaje(texto) {
    tarjetaPokemon.innerHTML = `<p class="mensaje-vacio">${texto}</p>`;
}


/* =====================================================================
 * RENDER: dibuja la pantalla a partir del estado
 * ---------------------------------------------------------------------
 * Una sola función decide qué se ve. No recibe parámetros: lee el
 * estado de arriba. Así es imposible que la rejilla y el botón se
 * contradigan, porque siempre se calculan juntos y de la misma fuente.
 * ===================================================================== */

function render() {
    /* Lo que se muestra NO se guarda en una variable aparte:
       se deriva del estado cada vez. Un dato, una fuente. */
    const visibles = allPokemons.filter((pokemon) => {

        // 1. Los tipos de ESTE Pokémon, como lista de textos: ["grass", "poison"]
        const pokemonTypes = pokemon.types.map((tipo) => tipo.type.name);

        // 2. ¿Pasa el filtro de texto?
        const pokemonName = pokemon.name.toLowerCase().includes(terminoBusqueda);

        // 3. ¿Pasa el filtro de tipos?
        //    Si no hay ninguno seleccionado, pasa todo el mundo.
        //    Si hay alguno, basta con que el Pokémon tenga uno de ellos.
        const pokemonType =
            filterType.length === 0 ||
            filterType.every((tipoFiltro) => pokemonTypes.includes(tipoFiltro));

        const pokemonFavs = 
            !soloFavoritos ||
            likes.includes(String(pokemon.id));


        // 5. Tiene que pasar los dos porteros
        return pokemonName && pokemonType && pokemonFavs;
    });


    const typesButtons = filter__by__types.querySelectorAll("[data-type]");

    typesButtons.forEach((button) => {
        const active = filterType.includes(button.dataset.type);

        button.setAttribute("aria-pressed", active);
        button.disabled = !active && filterType.length >= 2;
    });

    /* --- La rejilla --- */
    if (visibles.length === 0 ) {
        /* El mensaje cambia según por qué está vacío: no es lo mismo
           "no hay nada cargado" que "tu búsqueda no encuentra nada". */
        mostrarMensaje(
            terminoBusqueda
                ? `Ningún Pokémon cargado coincide con “${terminoBusqueda}”.`
                : "No hay Pokémon que mostrar."
        );
        
    }else if(filterType.length > 0){
        tarjetaPokemon.innerHTML = visibles.map(createTarjetaHTML).join("");
    } else {
        tarjetaPokemon.innerHTML = visibles.map(createTarjetaHTML).join("");
    }

    /* --- El botón de cargar más --- */
    buttonLoader.disabled = cargando || !hayMas;

    if (cargando) {
        buttonLoader.textContent = "Cargando…";
    } else if (!hayMas) {
        buttonLoader.textContent = "No hay más Pokémon";
    } else {
        buttonLoader.textContent = `Cargar más Pokemons`;
    }
}


/* =====================================================================
 * Traer una tanda de Pokémon
 * ===================================================================== */

async function obtenerPokemons() {
    /* Guarda: si ya hay una petición en marcha, o no quedan más,
       este clic se ignora. Evita duplicados por clics repetidos. */
    if (cargando || !hayMas) return;

    cargando = true;

    /* Solo en la primera carga la rejilla está vacía y conviene
       ocuparla con el mensaje. En las siguientes ya hay tarjetas
       visibles y borrarlas sería peor: basta con avisar en el botón. */
    if (allPokemons.length === 0) {
        mostrarMensaje("Cargando…");
    }
    render();

    try {
        /* 1) Lista ligera de la tanda: solo nombre y URL de cada uno. */
        const url = `https://pokeapi.co/api/v2/pokemon?limit=${POR_TANDA}&offset=${offset}`;
        const pokemonsResponse = await fetch(url);

        /* fetch no falla con un 404 o un 500: hay que comprobarlo a mano. */
        if (!pokemonsResponse.ok) {
            throw new Error(`El servidor respondió con código ${pokemonsResponse.status}`);
        }

        const pokemonsResponseData = await pokemonsResponse.json();
        const pokemonsList = pokemonsResponseData.results;

        /* La API dice en `next` si hay más páginas: null significa
           que esta era la última. Leemos el dato en vez de adivinarlo. */
        hayMas = pokemonsResponseData.next !== null;

        /* 2) Una petición de detalle por Pokémon, todas lanzadas a la vez.
              Sin `await` aquí: solo repartimos "tickets" (promesas). */
        const peticiones = pokemonsList.map((pokemonData) => fetch(pokemonData.url));

        /* 3) Primera ronda: esperar a que lleguen las respuestas. */
        const respuestas = await Promise.all(peticiones);

        /* 4) Segunda ronda: convertir cada respuesta en datos usables. */
        const detalles = await Promise.all(respuestas.map((r) => r.json()));

        /* 5) Acumular: lo que ya tenía, y detrás lo que acaba de llegar.
              El orden del spread es el orden final. */
        allPokemons = [...allPokemons, ...detalles];
        offset = offset + POR_TANDA;

    } catch (error) {
        /* Si ya había tarjetas en pantalla no las borramos: sería
           castigar al usuario por un fallo al pedir MÁS. */
        if (allPokemons.length === 0) {
            mostrarMensaje("No hemos podido cargar los datos. Comprueba tu conexión e inténtalo de nuevo.");
        }
        console.error(error);

    } finally {
        /* `finally` se ejecuta pase lo que pase. Es el sitio para
           soltar la bandera: si estuviera solo en el `try`, un fallo
           dejaría el botón bloqueado para siempre. */
        cargando = false;
        render();
    }
}

obtenerPokemons();


/* =====================================================================
 * Buscador
 * ===================================================================== */

search.addEventListener("input", (evento) => {
    /* El listener solo actualiza el estado; de pintar se encarga render(). */
    terminoBusqueda = evento.target.value.toLowerCase().trim();
    render();
});


/* =====================================================================
 * Botón "Cargar más"
 * ===================================================================== */

/* Listener directo: este botón está en el HTML desde el principio y no
   se destruye nunca, así que no hace falta delegación. */
buttonLoader.addEventListener("click", () => {
    obtenerPokemons();
});


/* =====================================================================
 * Clic en una tarjeta: abre la ficha de detalle
 * ===================================================================== */

/* Un solo listener en la rejilla (delegación): las tarjetas se crean y
   se destruyen con cada render, así que no pueden llevarlo ellas. */
tarjetaPokemon.addEventListener("click", async (evento) => {

    /* --- Guardas: esto no puede fallar, va fuera del try --- */
    const tarjeta = evento.target.closest(".pokemon--button--detalles");
    if (!tarjeta) return;
    const number = tarjeta.dataset.id;

    createModalWindow(number)
    
});


/* =====================================================================
 * Cerrar el modal
 * ===================================================================== */

/* El listener va en el <dialog>, que es permanente. El botón de cerrar
   se crea de nuevo con cada estado, así que no puede llevarlo él. */
tarjetaData.addEventListener("click", (evento) => {
    const botonCerrar = evento.target.closest(".modal__cerrar");
    if (!botonCerrar) return;

    tarjetaData.close();
});

filter__by__types.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-type]");
    if (!boton) return;

    const buttonType = boton.dataset.type;

    if (filterType.includes(buttonType)) {
        // 1. Ya estaba: lo quito.
        filterType = filterType.filter((t) => t !== buttonType);

    } else if (filterType.length < 2) {
        // 2. No estaba y hay hueco: lo añado.
        filterType = [...filterType, buttonType];
    }
    render();
});

tarjetaPokemon.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".favorito");
    if (!boton) return;

    const buttonFav = boton.dataset.id;
    const name = boton.dataset.name;

    if (likes.includes(buttonFav)) {
        // 1. Ya estaba: lo quito.
        likes = likes.filter((t) => t !== buttonFav);

    } else {
        // 2. No estaba y hay hueco: lo añado.
        likes = [...likes, buttonFav];
    }
    guardarFavs(likes)
    const ahoraEsFavorito = likes.includes(buttonFav);
    boton.setAttribute("aria-pressed", ahoraEsFavorito);
    boton.setAttribute("aria-label",`${ahoraEsFavorito ? "Quitar de" : "Añadir a"} ${name} favoritos`);
    
});

buttonfilterByFav.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".favorito__filter");
    if (!boton) return;

    if(!soloFavoritos){
        soloFavoritos = true
        buttonfilterByFav.setAttribute("aria-pressed", soloFavoritos);
    }else{

        soloFavoritos = false
        buttonfilterByFav.setAttribute("aria-pressed", soloFavoritos);
    }

    render()
});


/* =====================================================================
 * Silenciar los rugidos
 * ===================================================================== */

/* El HTML nace siempre con aria-pressed="false". Si el usuario silencio
   en una visita anterior, hay que reflejarlo al arrancar: el boton debe
   contar la verdad del estado, no el valor que venia escrito a mano. */
function pintarBotonMute() {
    buttonMute.setAttribute("aria-pressed", silenciado);
    buttonMute.setAttribute(
        "aria-label",
        silenciado ? "Activar los sonidos" : "Silenciar los sonidos"
    );
}

pintarBotonMute();

buttonMute.addEventListener("click", () => {
    silenciado = !silenciado;
    guardarSilencio(silenciado);
    pintarBotonMute();

    /* Silenciar con un rugido a medias sonando seria raro: se corta. */
    if (silenciado && sonidoActual) {
        sonidoActual.pause();
        sonidoActual.currentTime = 0;
    }
});

/* =====================================================================
 * Interruptor de paneles
 * ===================================================================== */

/* Recibe el boton porque cada ficha crea uno nuevo: no se puede
   guardar una referencia al arrancar la pagina. Los paneles se buscan
   dentro del modal por la misma razon. */
function pintarPaneles(boton) {
    if (!boton) return;

    /* Cuatro paneles, dos columnas. A la izquierda la foto se turna con
       la cadena evolutiva; a la derecha las estadisticas con la ficha
       de Pokedex. Los dos lados cambian a la vez. */
    const panelImg = tarjetaData.querySelector("#panel__img");
    const panelEvolucion = tarjetaData.querySelector("#panel__evolucion");
    const panelStats = tarjetaData.querySelector("#panel__stats");
    const panelPokedex = tarjetaData.querySelector("#panel__pokedex");

    /* Uno visible y el otro no: siempre lo contrario. */
    if (panelImg) panelImg.hidden = moreDetails;
    if (panelEvolucion) panelEvolucion.hidden = !moreDetails;
    if (panelStats) panelStats.hidden = moreDetails;
    if (panelPokedex) panelPokedex.hidden = !moreDetails;

    boton.setAttribute("aria-pressed", moreDetails);
    boton.setAttribute(
        "aria-label",
        moreDetails ? "Ver las estadísticas" : "Ver la descripción y las evoluciones"
    );
}

tarjetaData.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".switch__button");
    if (!boton) return;

    /* Primero cambia la verdad... */
    moreDetails = !moreDetails;

    /* ...y luego se dibuja. Al reves, la pokeball iria un clic por detras. */
    pintarPaneles(boton);
});


/* =====================================================================
 * Navegar a una evolucion
 * ---------------------------------------------------------------------
 * Aqui se cobra el refactor: como la ficha es una funcion con nombre y
 * no un listener, se puede abrir desde cualquier sitio. Un clic en una
 * evolucion es una apertura de ficha mas.
 * ===================================================================== */

tarjetaData.addEventListener("click", (evento) => {
    const eslabon = evento.target.closest("[data-evo-id]");
    if (!eslabon) return;

    /* data-evo-id se lee como dataset.evoId: los guiones del HTML se
       convierten en mayusculas en JavaScript. */
    /* true = no reinicies el panel: seguimos en modo Pokedex. */
    createModalWindow(eslabon.dataset.evoId, true);
});

