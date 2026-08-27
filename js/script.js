const tarjetaPokemon = document.getElementById("pokemon")
const tarjetaData = document.getElementById("pokemon__data")
const search = document.getElementById("search")
let allPokemons = []

function createElementalTypeHTM(types) {
    const type = types.map((tipo) => {
        const nombre = tipo.type.name;
        return `<span data-type="${nombre}">${nombre}</span>`;
    });

    return type.join("");
}

function drawPokemons(lista){
    const html = lista.map((pokemon) =>{

        const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
        
        return `
                <button class="pokemon--container" data-id="${pokemon.id}">
                    <img src="${img}" alt="Imagen de ${pokemon.name}" loading="lazy">

                    <span class="pokemon--detalles">

                        <span class="pokemon--id">#${pokemon.id}</span>

                        <span class="pokemon--name">${pokemon.name}</span>

                        <span class="pokemon--type">${createElementalTypeHTM(pokemon.types)}</span>

                    </span>

                </button>
            `;
    }).join("")
    tarjetaPokemon.innerHTML = html;
}



async function obtenerPokemons() {
        tarjetaPokemon.innerHTML = `<p>Cargando…</p>`;
    try{
        const pokemonsResponse = await fetch("https://pokeapi.co/api/v2/pokemon?limit=20");

        if (!pokemonsResponse.ok) {
            throw new Error(`El servidor respondió con código ${pokemonsResponse.status}`);
        }
    
        const pokemonsResponseData = await pokemonsResponse.json();
        const pokemonsList = pokemonsResponseData.results;

        const pokemonDetailsResponse = pokemonsList.map((pokemonData) => {
            return fetch(pokemonData.url)
        })

        const pokemonDetailsPromise = await Promise.all(pokemonDetailsResponse)

        const pokemonsDetailsList = await Promise.all(pokemonDetailsPromise.map(response => response.json()))
        
        allPokemons = pokemonsDetailsList;
        drawPokemons(allPokemons)

        const pokemons = pokemonsDetailsList.map((pokemon) =>{

            const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;

            return `
                <button class="pokemon--container" data-id="${pokemon.id}">
                    <img src="${img}" alt="Imagen de ${pokemon.name}" loading="lazy">

                    <span class="pokemon--detalles">

                        <span class="pokemon--id">#${pokemon.id}</span>

                        <span class="pokemon--name">${pokemon.name}</span>

                        <span class="pokemon--type">${createElementalTypeHTM(pokemon.types)}</span>

                    </span>

                </button>
            `;
        })

        tarjetaPokemon.innerHTML = pokemons.join("")
    } catch (error) {
        tarjetaPokemon.innerHTML = `<p>No hemos podido cargar los datos. Comprueba tu conexión e inténtalo de nuevo.</p>`;

        console.error(error);
    }

    
} obtenerPokemons();  

tarjetaPokemon.addEventListener("click", async (evento) => {

    const tarjeta = evento.target.closest(".pokemon--container");
    if (!tarjeta) return;
    const number = tarjeta.dataset.id;

    tarjetaData.innerHTML = `
        <button class="modal__cerrar" type="button">Cerrar</button>
        <p class="modal__mensaje">Cargando…</p>
    `;
    tarjetaData.showModal();

    try {
        const dataTarjetaResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${number}`);

        if (!dataTarjetaResponse.ok) {
            throw new Error(`El servidor respondió con código ${dataTarjetaResponse.status}`);
        }

        const dataTarjeta = await dataTarjetaResponse.json();
        const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dataTarjeta.id}.png`;

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
                        ${createElementalTypeHTM(dataTarjeta.types)}
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
        tarjetaData.innerHTML = `
            <button class="modal__cerrar" type="button">Cerrar</button>
            <p class="modal__mensaje">
                No hemos podido cargar este Pokémon.
                Comprueba tu conexión e inténtalo de nuevo.
            </p>
        `;
        console.error(error);
    }
})

tarjetaData.addEventListener("click", (evento) => {
    const botonCerrar = evento.target.closest(".modal__cerrar");
    if (!botonCerrar) return;

    tarjetaData.close();
});

search.addEventListener("input", (evento) => {

    const textSearch = evento.target.value.toLowerCase();

    const pokemonSearch = allPokemons.filter((pokemon) =>{
        return pokemon.name.toLowerCase().includes(textSearch);
    })

    drawPokemons(pokemonSearch)
});

