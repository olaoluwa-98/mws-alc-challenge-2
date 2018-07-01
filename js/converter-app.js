const API_URL = 'https://free.currencyconverterapi.com';
let elements = {
    signal: document.querySelector('#signal'),
    currencies1: document.querySelector('#currencies1'),
    currencies2: document.querySelector('#currencies2'),

    amount1: document.querySelector('#amount1'),
    amount2: document.querySelector('#amount2'),
    amount1Label: document.querySelector('#amount1Label'),
    amount2Label: document.querySelector('#amount2Label'),

    result: document.querySelector('#result'),

    snackbar: document.querySelector('#snackbar'),
    snackbarText: document.querySelector('#snackbar-text'),
};

const showToast = message => {
    elements.snackbarText.textContent = message;
    elements.snackbar.classList.add('show');
};

const closeToast = () => {
    elements.snackbar.classList.remove('show');
};

const openDB = () => {
    if (!navigator.serviceWorker) {
        return Promise.resolve();
    }

    return idb.open('currency-converter', 1, upgradeDb => {
        const currencyStore = upgradeDb.createObjectStore('currencies', {
            keyPath: 'name',
        });
        const conversionStore = upgradeDb.createObjectStore('conversions', {
            keyPath: 'id',
        });
    });
};

class CurrencyConverterApp {
    constructor() {
        this.currencies = [];
        this._db = openDB();
        this._registerServiceWorker();
        this._checkNetwork();
        this._getCurrencies();
    }

    _registerServiceWorker() {
        if (!navigator.serviceWorker) return;
        navigator.serviceWorker
            .register('/sw.js')
            .then(() => {
                console.log('Registered service worker!');
            })
            .catch(e => {
                console.log('Could not register service worker!', e);
            });
    }

    _updateNetworkStatus() {
        const app = this;
        debugger;
        if (navigator.onLine) {
            closeToast();
            showToast('Online');
            elements.signal.innerHTML= "network_wifi";
        } else {
            closeToast();
            showToast('Offline');
            elements.signal.innerHTML = "signal_wifi_off";
        }
    }    

    _checkNetwork() {
        window.addEventListener('online', this._updateNetworkStatus);
        window.addEventListener('offline', this._updateNetworkStatus);
    }
    
    _showCurrencies(currencies) {
        for (let currency of currencies) {
            const option = document.createElement('option');
            option.text = `${currency.name} (${currency.symbol || ''})`;
            option.value = currency.id;
            elements.currencies1.add(option);
        }
        for (let currency of currencies.reverse()) {
            const option = document.createElement('option');
            option.text = `${currency.name} (${currency.symbol || ''})`;
            option.value = currency.id;
            elements.currencies2.add(option);
        }
    }
    
    _storeCurrencies(currencies) {
        this._db.then(db => {
            if (!db) return;

            let tx = db.transaction('currencies', 'readwrite');
            let store = tx.objectStore('currencies');
            store.openCursor(null).then(function deleteRest(cursor) {
                if (!cursor) return;
                cursor.delete();
                return cursor.continue().then(deleteRest);
            });
            currencies.forEach(currency => {
                store.put(currency);
            });
        });
    }

    _getCurrencies() {
        const app = this;
        try {
            if (navigator.onLine) {
                let res = new Promise((resolve, reject) => {
                    return fetch(`${API_URL}/api/v5/currencies`).then(response => {
                        resolve(response.json());
                    });
                });
                res.then(response => {
                    app.currencies = Object.keys(response.results).map(key => {
                        return {
                            id: response.results[key].id,
                            name: response.results[key].currencyName,
                            symbol: response.results[key].currencySymbol,
                        };
                    });
                    app._showCurrencies(app.currencies);
                    app._storeCurrencies(app.currencies);
                });
            } else {
                app._dbPromise.then(db => {
                    if (!db) return;

                    let tx = db.transaction('currencies').objectStore('currencies');
                    return tx.getAll().then(currencies => {
                        app._showCurrencies(currencies);
                    });
                });
            }
        } catch (e) {
            console.log(e)
            showToast('Error occured');
        }
    }

    _displayConversion(rate, query) {
        const app = this;
        const currency1 = query.split('_')[0];
        const currency2 = query.split('_')[1];
        elements.result.textContent = `1${
          app.currencies.find(x => currency1 == x.id ).symbol || 
          app.currencies.find(x => currency1 == x.id ).name
        } equals
        ${
          app.currencies.find(x => currency2 == x.id).symbol || 
          app.currencies.find(x => currency2 == x.id).name
        }${rate}        
        `;
    }

    _applyConversion(rate, query) {
        const app = this;
        app._displayConversion(rate, query);
        if (app.inputTrigger == 'input1') {
            elements.input2.value = Number(elements.input1.value) * Number(rate);
        } else if (app.inputTrigger == 'input2') {
            elements.input1.value = Number(elements.input2.value) / Number(rate);
        }
    }

    fetchConversionRate() {
        const app = this;
        const currency1 = elements.currencies1.value;
        const currency2 = elements.currencies2.value;
        const query = `${currency1.toUpperCase()}_${currency2.toUpperCase()}`;
        try {
            if (navigator.onLine) {
                let promise = new Promise((resolve, reject) => {
                    return fetch(`${API_URL}/api/v5/convert?q=${query}`).then(
                        response => {
                            resolve(response.json());
                        },
                    );
                });
                promise.then(response => {
                    app._applyConversion(
                        response.results[query].val,
                        query,
                    );
                    app._storeConversionInIDB(response.results[query]);

                });
            } else {
                app._getConversionFromIDB(query);
            }
        } catch (error) {
            console.log(e);
            showToast('Error occured in fetching conversion rates');
        }
    }

    changeAmount(inputTrigger = 'input1') {
        const app = this;
        app.inputTrigger = inputTrigger;
        app.fetchConversionRate();
    }
}

const currencyApp = new CurrencyConverterApp();