import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/config/env.dart';

class CurrencyScreen extends StatefulWidget {
  const CurrencyScreen({super.key});

  @override
  State<CurrencyScreen> createState() => _CurrencyScreenState();
}

class _CurrencyScreenState extends State<CurrencyScreen> {
  final _amountController = TextEditingController();
  double? _convertedAmount;
  double? _exchangeRate;
  bool _isLoading = false;
  String _error = '';
  String _baseCurrency = 'USD';
  String _targetCurrency = 'EUR';

  final List<String> _currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MYR'];

  Future<void> _convertCurrency() async {
    if (_amountController.text.isEmpty) return;
    
    setState(() {
      _isLoading = true;
      _error = '';
      _convertedAmount = null;
    });

    try {
      final amount = double.tryParse(_amountController.text) ?? 0;
      final url = Uri.parse(
        '${Env.baseUrl}/currency?base=$_baseCurrency&target=$_targetCurrency'
      );
      
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          _exchangeRate = data['rate'];
          _convertedAmount = amount * _exchangeRate!;
        });
      } else {
        setState(() {
          _error = 'Conversion failed: ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Currency Converter',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.blue[800],
            ),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Amount',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(12)),
              ),
              prefixIcon: Icon(Icons.attach_money),
              suffixIcon: Icon(Icons.clear),
            ),
            onChanged: (value) => _convertCurrency(),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _baseCurrency,
                  decoration: const InputDecoration(
                    labelText: 'From',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                    ),
                  ),
                  items: _currencies
                      .map((currency) => DropdownMenuItem<String>(
                            value: currency,
                            child: Text(currency),
                          ))
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _baseCurrency = value!;
                    });
                    _convertCurrency();
                  },
                ),
              ),
              const SizedBox(width: 16),
              const Icon(Icons.arrow_forward, color: Colors.blue),
              const SizedBox(width: 16),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _targetCurrency,
                  decoration: const InputDecoration(
                    labelText: 'To',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                    ),
                  ),
                  items: _currencies
                      .map((currency) => DropdownMenuItem<String>(
                            value: currency,
                            child: Text(currency),
                          ))
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _targetCurrency = value!;
                    });
                    _convertCurrency();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 30),
          if (_isLoading) const Center(child: CircularProgressIndicator()),
          if (_error.isNotEmpty)
            Center(
              child: Text(
                _error,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          if (_convertedAmount != null && !_isLoading)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blue[100]!),
              ),
              child: Column(
                children: [
                  Text(
                    '${_amountController.text} $_baseCurrency =',
                    style: const TextStyle(fontSize: 18),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${_convertedAmount!.toStringAsFixed(2)} $_targetCurrency',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.green[800],
                    ),
                  ),
                  const SizedBox(height: 15),
                  if (_exchangeRate != null)
                    Text(
                      '1 $_baseCurrency = ${_exchangeRate!.toStringAsFixed(4)} $_targetCurrency',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                ],
              ),
            ),
          const Spacer(),
          if (!_isLoading)
            ElevatedButton(
              onPressed: _convertCurrency,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Center(
                child: Text(
                  'CONVERT',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}