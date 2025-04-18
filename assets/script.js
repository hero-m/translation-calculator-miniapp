var TRANSLATION_RATES_URL = 'assets/rates-1404h1-v1.json';
// var TRANSLATION_RATES_URL = 'https://hero-m.github.io/translation-calculator-miniapp/assets/rates-1404h1-v1.json';

var CURRENCY = 'تومان';

var EMPTY_CHOICE = 'گزینه‌ای را انتخاب کنید';

var calcParams = {

  workUnits: {
    'text': 'کلمه',
    'interpret': 'روز',
    'interpret-remote': 'ساعت',
    'media': 'دقیقه',
    'media-subtitles': 'خط',
    'media-dub': 'خط',
    'apps': 'کلمه'
  },

  specialtyLabels: {
    'text': 'ترجمه کتبی',
    'interpret': 'ترجمه شفاهی',
    'media': 'ترجمه رسانه',
    'apps': 'ترجمه نرم‌افزار'
  }
};

var calcData = {};

var stepnum = 1;

const errorModal = new bootstrap.Modal('#error-modal');

async function fetch_translation_rates() {
  var split = TRANSLATION_RATES_URL.split('/');
  var ratesId = split[split.length - 1];
  var cachedId = localStorage.getItem('cachedRatesId');
  if (cachedId != null && cachedId == ratesId) {
    //return JSON.parse(localStorage.getItem('cachedRates'));
  }

  try {
    const response = await fetch(TRANSLATION_RATES_URL);
    if (!response.ok) {
      throw new Error("Bad network response (status: " + response.status + ")");
    }

    const data = await response.json();
    localStorage.setItem('cachedRates', JSON.stringify(data));
    localStorage.setItem('cachedRatesId', ratesId);
    return data;
  } catch (error) {
    console.error("Error fetching translation rates.");
  }
}

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

      $('.rates-version').text(result['version-title']);

      if (inMiniApp) {
        Telegram.WebApp.BackButton.onClick(function (event) {
          stepBack();
        });
      }
      
      $('.actions-intro .action-btn').on('click', function (event) {
        stepnum = 2;
        calcData.specialty = this.dataset.value;
        $('.select-group').hide();
        $('.select-group.' + calcData.specialty + "-field").show();
        $("#field-work-amount .field-suffix").text(get_work_unit());
        $('.header-specialty').text($(this).text());
        $('#card-input-form').addClass('card-visible');
        $('#card-intro').removeClass('card-visible');
        
        if (inMiniApp) {
          Telegram.WebApp.BackButton.show();
        }
      });

      $('.action-btn.choice-cancel').on('click', function (event) {
        stepBack();
      });

      $('.action-btn.choice-submit').on('click', function (event) {
        if (stepnum == 2) {
          if (validateFields()) {
            computeRates();
            $('#card-result').addClass('card-visible');
            $('#card-input-form').removeClass('card-visible');
            stepnum = 3;
          } else {
            errorModal.show();
          }
        }
      });
      
      $('.select-group').on('click', function (event) {
        $('.select-items', this).toggleClass('open');
        $('#overlay').toggleClass('hidden');
      });

      $('.field-group input').on('change', function (event) {
        var fieldId = this.closest('.field-group').dataset.id;
        calcData[fieldId] = this.value;
      });

      $('#overlay').on('click', element => {
        $('.select-items.open').removeClass('open');
        $('#overlay').addClass('hidden');
      });

      $('.select-item').on('click', function (event) {
        var fieldGroup = this.closest('.field-group');
        var dataValue = this.dataset.value;
        var dataId = fieldGroup.dataset.id;
        calcData[dataId] = dataValue;
        var selectedItem = fieldGroup.querySelector('.selected-item');
        selectedItem.innerHTML = this.innerHTML;
        selectedItem.classList.remove('item-none');

        if (dataId == 'text_service') {
          if (['analysis', 'edit-human', 'edit-machine'].includes(dataValue)) {
            var level4 = $('#field-text-skill .skill-sp');

            $('#field-text-skill .selected-item').text(level4.text()).removeClass('item-none');
            calcData['text_skill'] = level4.data('value');

            $('#field-text-skill .skill-set1').hide();
            $('#field-text-skill .select-items').addClass('disabled');
          } else {
            $('#field-text-skill .selected-item').text(EMPTY_CHOICE).addClass('item-none');
            delete calcData['text_skill'];

            $('#field-text-skill .skill-set1').show();
            $('#field-text-skill .select-items').removeClass('disabled');
          }
        }
        
        $("#field-work-amount .field-suffix").text(get_work_unit());
      });

      document.getElementById('rates-download-link').addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        window.Telegram.WebApp.openLink(this.getAttribute('href'), { try_instant_view: true });
      });
      
      $('input[type="number"]').on('keypress', function (event) {
        var code = event.keyCode;
        var zeroFa = '۰'.charCodeAt(0);
        var diff = code - zeroFa;
        if (0 <= diff && diff < 10) {
          event.keyCode = '0'.charCodeAt(0) + diff;
        }
      });

      if (inMiniApp) {
        window.Telegram.WebApp.ready();
      }
    }
  });
}

function get_work_unit() {
  var units = calcParams.workUnits;

  if (calcData.specialty == 'interpret') {
    if (calcData.interpret_service == 'remote') {
      return units['interpret-remote'];
    }
  } else if (calcData.specialty == 'media') {
    if (calcData.media_service == 'translate-subtitles') {
      return units['media-subtitles'];
    } else if (calcData.media_service == 'translate-dubbed') {
      return units['media-dub'];
    }
  }

  return units[calcData.specialty];
}

function get_work_unit_per_item() {
  var unit = get_work_unit();

  if (unit[unit.length - 1] == 'ه') {
    return unit + '‌ای';
  } else {
    return unit + 'ی';
  }
}

function getBaseRate() {
  var rates = calcParams.translationRates['base-values'][calcData.specialty];
  if (calcData.specialty == 'text') {
    return rates[calcData.text_service];
  } else if (calcData.specialty == 'interpret') {
    return rates[calcData.interpret_service][calcData.shared_language];
  } else if (calcData.specialty == 'media') {
    return rates[calcData.media_service][calcData.shared_language];
  } else if (calcData.specialty == 'apps') {
    return rates[calcData.shared_language];
  }
}

function getMultiplier() {
  var result = 1;
  var multipliers = calcParams.translationRates['multipliers'];
  for (var field in multipliers) {
    if (field in calcData) {
      result *= multipliers[field][calcData[field]];
    }
  }

  return result;
  if (calcData.specialty == 'text') {
    var multipliers = calcParams.translationRates['multipliers']['text'];
    return multipliers['text_skill'][calcData.text_skill] * 
           multipliers['text_speed'][calcData.text_speed] * 
           multipliers['text_topic'][calcData.text_topic] * 
           multipliers['text_language'][calcData.text_language];
  } else if (calcData.specialty == 'interpret') {
    var multipliers = calcParams.translationRates['multipliers']['shared'];
    return multipliers['shared_skill'][calcData.shared_skill] * 
           multipliers['shared_topic'][calcData.shared_topic];
  } else if (calcData.specialty == 'media') {
  } else {
    var multipliers = calcParams.translationRates['multipliers']['shared'];
    return multipliers['shared_skill'][calcData.shared_skill] * 
           multipliers['shared_topic'][calcData.shared_topic];
  }
}

function computeRates() {
  var baseRate = getBaseRate();
  var multiplier = getMultiplier();
  var combinedRate = Math.round(baseRate * multiplier);
  $('#base-rate').text(get_work_unit_per_item() + ' ' + formatNumber(baseRate, 0));
  $('#rate-multiplier').text(formatNumber(multiplier, 2));
  $('#combined-rate').text(get_work_unit_per_item() + ' ' + formatNumber(combinedRate, 0));

  if (calcData.work_amount != null && calcData.work_amount > 0) {
    var minimumSalary = combinedRate * calcData.work_amount;
    $('#minimum-salary').text(formatNumber(minimumSalary, 0)).closest('.field').show();
  } else {
    $('#minimum-salary').closest('.field').hide();
  }

  $('.selections-box .field').hide();
  $('#choice-specialty').html(calcParams.specialtyLabels[calcData.specialty]).parent().show();
  for (const field in calcData) {
    if (field == 'work_amount') {
      var work_amount = $('#field-work-amount input').val();
      var label = formatNumber(work_amount) + ' ' + get_work_unit();
      $('#choice-' + field).html(label);
    } else {
      var label = $('.field-group[data-id="' + field + '"] .selected-item').html();
      $('#choice-' + field).html(label);
    }
    $('#choice-' + field).closest('.field').show();
  }
}

function validateFields() {
  var valid = true;
  $('#general-errors').html('').hide();
  $('#required-fields-label').hide();
  $('#required-fields').html('').hide();
  if (!['text', 'interpret', 'media', 'apps'].includes(calcData.specialty)) {
    $('#general-errors').html('برخی از مقادیر انتخابی نامعتبر است.').show();
    return false;
  } else {
    $('#card-input-form .select-group.' + calcData.specialty + "-field").each(function () {
      var fieldId = this.dataset.id;
      if (calcData[fieldId] == null || $('.selected-item', this).hasClass('item-none')) {
        $('#required-fields-label').show();
        $('#required-fields').append('<li>' + $('.field-label', this).text() + '</li>').show();
        valid = false;
      }
    });
  }

  return valid;
}

function stepBack() {
  if (stepnum == 2) {
    if (inMiniApp) {
      Telegram.WebApp.BackButton.hide();
    }
    $('#card-intro').addClass('card-visible');
    $('#card-input-form').removeClass('card-visible');
    $('#card-input-form .selected-item').html(EMPTY_CHOICE).addClass('item-none');
    $('#card-input-form input').val('');
    $('#card-input-form .card-content').scrollTop();
    calcData = {};
    stepnum = 1;
  } else if (stepnum == 3) {
    stepnum = 2;
    $('#card-input-form').addClass('card-visible');
    $('#card-result').removeClass('card-visible');
  }
}

function formatNumber(number, fraction) {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: fraction }).format(number);
}

function handleKeyPress(event){
  var code = event.keyCode;
  var zeroFa = '۰'.charCodeAt(0);
  var diff = code - zeroFa;
  if (0 <= diff && diff < 10) {
    event.keyCode = '0'.charCodeAt(0) + diff;
  }
}

initialize();
