// window.Telegram.WebApp

var TRANSLATION_RATES_URL = 'https://hero-m.github.io/translation-calculator-miniapp/rates-1403h2-v1.json';

var CURRENCY = 'تومان';

var EMPTY_CHOICE = 'گزینه‌ای را انتخاب کنید';

var calcParams = {

  workUnits: {
    'text': 'کلمه',
    'interpret': 'ساعت',
    'media': {
      'translate_subtitles': 'خط',
      'other': 'دقیقه'
    },
    'apps': 'کلمه'
  },
};

var calcData = {
  stepnum: 1
};

function initialize() {

  window.inMiniApp = typeof Telegram !== 'undefined';
  
  $('.selected-item').innerHTML = EMPTY_CHOICE;
  $('input').val('');

  fetch_translation_rates().then(function (result) {
    if (result == null) {
      if (inMiniApp) { 
        // TODO: افزودن دکمه‌های تلاش مجدد و خروج
        Telegram.WebApp.showPopup({
          title: 'خطا',
          message: 'خطا در بارگزاری جدول نرخ‌نامه.',
          buttons: [
            {id: 'close', type: 'close'} // type: 'ok', 'close', 'cancel', 'destructive', 'default', ...
          ], function (buttonId) {
            Telegram.WebApp.close();
          }
        });
      }
    } else {
      calcParams.translationRates = result;
      
      $('.actions-intro .action-btn').on('click', function (event) {
        calcData.stepnum = 2;
        calcData.translation_type = this.dataset.value;
        $('#card-' + calcData.translation_type).addClass('card-visible');
        $('#card-intro').removeClass('card-visible');
      });

      $('.action-btn.choice-cancel').on('click', function (event) {
        if (calcData.stepnum == 2) {
          var activeCard = $('.card-visible')[0];
          $('#card-intro').addClass('card-visible');
          $(activeCard).removeClass('card-visible');
          $('.selected-item').html(EMPTY_CHOICE).addClass('item-none');
          $('input', activeCard).val('');
          $('.card-content', activeCard).scrollTop();
          calcData = {stepnum: 1};
        }
      })
      
      $('.field-group:has(.select-items)').on('click', function (event) {
        $('.select-items', this).toggleClass('open');
        $('#overlay').toggleClass('hidden');
      });

      $('#overlay').on('click', element => {
        $('.select-items.open').removeClass('open');
        $('#overlay').addClass('hidden');
      });

      $('.select-item').on('click', function (event) {
        var dataValue = this.dataset.value;
        var dataId = this.closest('.select-items').dataset.id;
        calcData[dataId] = dataValue;
        var selectedItem = this.closest('.field-group').querySelector('.selected-item');
        selectedItem.innerHTML = this.innerHTML;
        selectedItem.classList.remove('item-none');

        if (dataId == 'text_service' && ['analysis', 'edit-human', 'edit-machine'].includes(dataValue)) {
          
        }
      });

      if (inMiniApp) {
        window.Telegram.WebApp.ready();
      }
    }
  });
}

initialize();



//////////////////////////////////////////////////////////////////////////////////

var calculator_definitions = {
  work_units: {
    'text': 'کلمه',
    'interpret': 'ساعت',
    'media': {
      'translate_subtitles': 'خط',
      'other': 'دقیقه'
    },
    'apps': 'کلمه'
  },

  baserate_parameters: {
    'text': ['text-translation-type'],
    'interpret': ['interpret-type', 'common-language'],
    'media': ['media-type', 'common-language'],
    'apps': ['common-language']
  },

  parameter_groups: {
    '': [],
    'text': ['text-parameters', 'work-parameter'],
    'interpret': ['interpret-parameters', 'common-parameters', 'common-language-parameter', 'work-parameter'],
    'media': ['media-parameters', 'common-parameters', 'common-language-parameter', 'work-parameter'],
    'apps': ['common-parameters', 'common-language-parameter', 'work-parameter']
  },

  translation_rates: null,
  multipliers: null
}


function rtc_initialize() {
  fetch_translation_rates(0).then(function (result) {
    if (result != null) {

      document.getElementById('rates-download-link').addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        window.Telegram.WebApp.openLink(this.getAttribute('href'), { try_instant_view: true });
      })

      // update_translation_type();
      // display_rates();
    }
  });
}

function update_translation_type() {
  var translation_type = _rtcval('translation-type');
  document.querySelectorAll('.' + 'parameter-group').forEach(element => {
    if (calculator_definitions.parameter_groups[translation_type].includes(element.id)) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  });

  if (translation_type == 'text') {
    update_text_translation_type();
  }

  document.getElementById('work-amount').value = '';
  if (translation_type != '') {
    _rtctext('work-unit', get_work_unit());
  }
}

function update_text_translation_type() {
  var hidettt = ['analysis', 'edit-human', 'edit-machine'].includes(_rtcval('text-translation-type'));
  document.getElementById('text-translation-skill-parameter').style.display = hidettt ? 'none' : '';
}

function display_rates() {
  var calculated_rates = calculate_rates();

  for (const [key, value] of Object.entries(calculated_rates)) {
    if (value == 0) {
      _rtctext('result-' + key, 'فیلدهای بیشتری را مشخص کنید');
    } else {
      if (key == 'base-rate') {
        _rtctext('result-base-rate', get_work_unit_per_item() + ' ' + _rtcformat(value, 0) + ' ' + CURRENCY);
      } else if (key == 'multiplier') {
        _rtctext('result-multiplier', '⨯ ' + _rtcformat(value, 2));
      } else if (key == 'combined-rate') {
        _rtctext('result-combined-rate', get_work_unit_per_item() + ' ' + _rtcformat(value, 0) + ' ' + CURRENCY);
      } else if (key == 'total-price') {
        _rtctext('result-total-price', _rtcformat(value, 0) + ' ' + CURRENCY);
      }
    }
  }
}

function calculate_rates() {
  var results = {
    'base-rate': 0,
    'multiplier': 0,
    'combined-rate': 0,
    'total-price': 0
  };

  var translation_type = _rtcval('translation-type');
  if (translation_type != '') {
    results['base-rate'] = calculate_base_rate(translation_type);

    if (translation_type == 'text') {
      var multipliers = { ...calculator_definitions.translation_rates['multipliers']['text'] };
      var hidettt = ['analysis', 'edit-human', 'edit-machine'].includes(_rtcval('text-translation-type'));
      if (hidettt) {
        delete multipliers['text-translation-skill'];
      }
      results['multiplier'] = calculate_multipliers(multipliers);
    } else {
      var multipliers = calculator_definitions.translation_rates['multipliers']['common'];
      results['multiplier'] = calculate_multipliers(multipliers);
    }

    results['combined-rate'] = results['base-rate'] * results['multiplier'];
    results['total-price'] = results['combined-rate'] * _rtcval('work-amount');
  }

  return results;
}

function calculate_base_rate(translation_type) {
  var parameters = calculator_definitions.baserate_parameters;
  var base_values = calculator_definitions.translation_rates['base-values'];

  var runner = base_values[translation_type];
  for (let i = 0; i < parameters[translation_type].length; i++) {
    var field = parameters[translation_type][i];
    var value = _rtcval(field);
    if (value == '') {
      return 0;
    }

    runner = runner[value];
  }

  return runner;
}

function calculate_multipliers(parameters) {
  var result = 1;

  var keys = Object.keys(parameters);
  for (var i = 0; i < keys.length; i++) {
    var choice = _rtcval(keys[i]);
    if (choice == '') {
      return 0;
    }

    var value = parameters[keys[i]][choice];
    if (choice == undefined) {
      return 0;
    }

    result *= value;
  }

  return result;
}

function get_work_unit() {
  var units = calculator_definitions.work_units;

  var translation_type = _rtcval('translation-type');
  if (translation_type == 'media') {
    var media_type = _rtcval('media-type');
    if (media_type == 'translate-subtitles') {
      return units['media']['translate_subtitles'];
    }

    return units['media']['other'];
  }

  return units[translation_type];
}

function get_work_unit_per_item() {
  var unit = get_work_unit();

  if (unit[unit.length - 1] == 'ه') {
    return unit + '‌ای';
  } else {
    return unit + 'ی';
  }
}

async function fetch_translation_rates() {
  try {
    const response = await fetch(TRANSLATION_RATES_URL);
    if (!response.ok) {
      throw new Error("Bad network response (status: " + response.status + ")");
    }

    const data = await response.json();
    localStorage.setItem("translation-rates", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error fetching translation rates.");
  }
}

function _rtcformat(number, fraction) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: fraction }).format(number);
}

function _rtcval(element_id) {
  return document.getElementById(element_id).value;
}

function _rtctext(element_id, value) {
  document.getElementById(element_id).textContent = value;
}

// rtc_initialize();