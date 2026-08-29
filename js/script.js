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


/* =====================================================================
 * ESTADO
 * ---------------------------------------------------------------------
 * Todo lo que la aplicación "recuerda" entre una acción y otra.
 * Regla: un dato, una variable. Nada que se pueda calcular a partir
 * de estas se guarda aparte — se calcula en el momento.
 * ===================================================================== */

let allPokemons = [];        // los Pokémon ya descargados (la "despensa")
let allPokemonsType = []
let offset = 0;              // por dónde va la paginación (el marcapáginas)
let hayMas = true;           // ¿quedan más tandas en la API?
let cargando = false;        // ¿hay una petición en curso ahora mismo?
let terminoBusqueda = "";    // lo que el usuario tiene escrito en el buscador
let filterType = []
let soloFavoritos = false;
const favs = "like"

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
    const esFavorito = likes.includes(`${pokemon.id}`);

    /* El segundo tipo puede no existir: si no lo hay, repetimos el
       primero para que el degradado quede en color plano. */
    const type1 = pokemon.types[0].type.name;
    const type2 = pokemon.types[1] ? pokemon.types[1].type.name : type1;

    return `
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

function cargarFavs() {
    const guardadoFavs = localStorage.getItem(favs);
    return guardadoFavs ? JSON.parse(guardadoFavs) : [];
}
function guardarFavs(like) {
    localStorage.setItem(favs, JSON.stringify(like));
}

let likes = cargarFavs();

console.log(likes)

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
        console.log(allPokemons)
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

    /* --- Estado de carga: el modal se abre YA, antes de pedir nada --- */
    /* Quitamos los tipos del Pokemon anterior: mientras carga no
       sabemos aun de que tipo es el nuevo. */
    tarjetaData.removeAttribute("data-type-1");
    tarjetaData.removeAttribute("data-type-2");

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
        let statTotal = 0

        const pokemonStats = dataTarjeta.stats.map((pokemonInfo) => {
            statTotal = pokemonInfo.base_stat + statTotal;
            return `
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


//location_area_encounter /api/v2/pokémon/35/encuentros
//gritos https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/35.ogg
// sheiny mega omega etc