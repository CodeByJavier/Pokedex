/* =====================================================================
 * Pokédex — lista, buscador, carga por tandas y ficha de detalle
 * ===================================================================== */

/* --- Referencias a elementos del HTML ---
   Se buscan una sola vez, al arrancar, y se reutilizan siempre. */
const tarjetaPokemon = document.getElementById("pokemon");
const tarjetaData = document.getElementById("pokemon__data");
const search = document.getElementById("search");
const buttonLoader = document.getElementById("loader__button");


/* =====================================================================
 * ESTADO
 * ---------------------------------------------------------------------
 * Todo lo que la aplicación "recuerda" entre una acción y otra.
 * Regla: un dato, una variable. Nada que se pueda calcular a partir
 * de estas se guarda aparte — se calcula en el momento.
 * ===================================================================== */

let allPokemons = [];        // los Pokémon ya descargados (la "despensa")
let offset = 0;              // por dónde va la paginación (el marcapáginas)
let hayMas = true;           // ¿quedan más tandas en la API?
let cargando = false;        // ¿hay una petición en curso ahora mismo?
let terminoBusqueda = "";    // lo que el usuario tiene escrito en el buscador

const POR_TANDA = 20;

const URL_ARTWORK =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";


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

    return `
        <button class="pokemon--container" data-id="${pokemon.id}">
            <img src="${img}" alt="Imagen de ${pokemon.name}" loading="lazy">

            <span class="pokemon--detalles">
                <span class="pokemon--id">#${pokemon.id}</span>
                <span class="pokemon--name">${pokemon.name}</span>
                <span class="pokemon--type">${createElementalTypeHTML(pokemon.types)}</span>
            </span>
        </button>
    `;
}

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
        return pokemon.name.toLowerCase().includes(terminoBusqueda);
    });

    /* --- La rejilla --- */
    if (visibles.length === 0) {
        /* El mensaje cambia según por qué está vacío: no es lo mismo
           "no hay nada cargado" que "tu búsqueda no encuentra nada". */
        mostrarMensaje(
            terminoBusqueda
                ? `Ningún Pokémon cargado coincide con “${terminoBusqueda}”.`
                : "No hay Pokémon que mostrar."
        );
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
    const tarjeta = evento.target.closest(".pokemon--container");
    if (!tarjeta) return;
    const number = tarjeta.dataset.id;

    /* --- Estado de carga: el modal se abre YA, antes de pedir nada --- */
    tarjetaData.innerHTML = `
        <button class="modal__cerrar" type="button">Cerrar</button>
        <p class="modal__mensaje">Cargando…</p>
    `;
    tarjetaData.showModal();

    /* --- Petición: aquí sí puede fallar --- */
    try {
        const dataTarjetaResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${number}`);

        if (!dataTarjetaResponse.ok) {
            throw new Error(`El servidor respondió con código ${dataTarjetaResponse.status}`);
        }

        const dataTarjeta = await dataTarjetaResponse.json();
        const img = `${URL_ARTWORK}/${dataTarjeta.id}.png`;

        const pokemonStats = dataTarjeta.stats.map((pokemonInfo) => {
            return `
                <li class="stat">
                    <span class="stat__nombre">${pokemonInfo.stat.name}:</span>
                    <span class="stat__valor">${pokemonInfo.base_stat}</span>
                </li>
            `;
        });

        tarjetaData.innerHTML = `
            <button class="modal__cerrar" type="button">Cerrar</button>

            <div class="modal__grid">

                <div class="modal__img">
                    <img src="${img}" alt="Imagen de ${dataTarjeta.name}">

                    <p class="modal__id pokemon--id">#${dataTarjeta.id}</p>
                    <h2 class="modal__name pokemon--name">${dataTarjeta.name}</h2>
                    <div class="modal__tipos pokemon--type">
                        ${createElementalTypeHTML(dataTarjeta.types)}
                    </div>
                </div>

                <div class="modal__info">

                    <h3>Estadísticas base</h3>

                    <ul class="modal__stats">
                        ${pokemonStats.join("")}
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
            </div>
        `;

    } catch (error) {
        /* Cada estado debe traer su propia salida: sin este botón,
           el usuario quedaría encerrado en el modal. */
        tarjetaData.innerHTML = `
            <button class="modal__cerrar" type="button">Cerrar</button>
            <p class="modal__mensaje">
                No hemos podido cargar este Pokémon.
                Comprueba tu conexión e inténtalo de nuevo.
            </p>
        `;
        console.error(error);
    }
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
