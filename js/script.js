/* =====================================================================
 * Pokédex — lista, buscador y ficha de detalle
 * ===================================================================== */

/* --- Referencias a elementos del HTML ---
   Se buscan una sola vez, al arrancar, y se reutilizan siempre. */
const tarjetaPokemon = document.getElementById("pokemon");
const tarjetaData = document.getElementById("pokemon__data");
const search = document.getElementById("search");

/* La "despensa": aquí se guardan los datos traídos de la API.
   Es `let` porque su valor cambia (empieza vacía y luego se llena). */
let allPokemons = [];

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

/* Pinta en la rejilla la lista que se le pase.
   No decide QUÉ pintar: eso lo decide quien la llama. */
function drawPokemons(lista) {
    /* Caso "sin resultados": una rejilla vacía parecería un error. */
    if (lista.length === 0) {
        tarjetaPokemon.innerHTML = `
            <p class="mensaje-vacio">
                Ningún Pokémon coincide con esa búsqueda.
            </p>
        `;
        return;
    }

    tarjetaPokemon.innerHTML = lista.map(createTarjetaHTML).join("");
}


/* =====================================================================
 * Carga inicial: trae los datos y los guarda
 * ===================================================================== */

async function obtenerPokemons() {
    tarjetaPokemon.innerHTML = `<p class="mensaje-vacio">Cargando…</p>`;

    try {
        /* 1) Lista ligera: solo nombre y URL de cada Pokémon. */
        const pokemonsResponse = await fetch("https://pokeapi.co/api/v2/pokemon?limit=20");

        if (!pokemonsResponse.ok) {
            throw new Error(`El servidor respondió con código ${pokemonsResponse.status}`);
        }

        const pokemonsResponseData = await pokemonsResponse.json();
        const pokemonsList = pokemonsResponseData.results;

        /* 2) Una petición de detalle por Pokémon, todas lanzadas a la vez.
              Sin `await` aquí: solo repartimos "tickets" (promesas). */
        const peticiones = pokemonsList.map((pokemonData) => fetch(pokemonData.url));

        /* 3) Primera ronda: esperar a que lleguen las 20 respuestas. */
        const respuestas = await Promise.all(peticiones);

        /* 4) Segunda ronda: convertir cada respuesta en datos usables. */
        const detalles = await Promise.all(respuestas.map((r) => r.json()));

        /* 5) Guardar en la despensa y pintar. */
        allPokemons = detalles;
        drawPokemons(allPokemons);

    } catch (error) {
        tarjetaPokemon.innerHTML = `
            <p class="mensaje-vacio">
                No hemos podido cargar los datos. Comprueba tu conexión e inténtalo de nuevo.
            </p>
        `;
        console.error(error);
    }
}

obtenerPokemons();


/* =====================================================================
 * Buscador: filtra la despensa y repinta
 * ===================================================================== */

search.addEventListener("input", (evento) => {
    const textSearch = evento.target.value.toLowerCase();

    /* .filter() se queda con los que devuelven true. */
    const pokemonSearch = allPokemons.filter((pokemon) => {
        return pokemon.name.toLowerCase().includes(textSearch);
    });

    drawPokemons(pokemonSearch);
});


/* =====================================================================
 * Clic en una tarjeta: abre la ficha de detalle
 * ===================================================================== */

/* Un solo listener en la rejilla (delegación): funciona también con las
   tarjetas que se crean después, al buscar. */
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

        /* fetch no falla con un 404: hay que comprobarlo a mano. */
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
