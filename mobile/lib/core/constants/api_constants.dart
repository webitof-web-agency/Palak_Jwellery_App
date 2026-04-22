class ApiConstants {
  // 10.0.2.2 = Android emulator → your dev machine
  // 192.168.1.40 = real Android device on same WiFi → your dev machine
  // Change to your machine's IP when testing on a real device
  static const String baseUrl = 'http://192.168.1.56:3000';
  static const String apiPrefix = '/api/v1';
}
