import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../core/constants.dart';

/// Fetches a driving route line between two points from the free public
/// OSRM demo server. Returns an empty list on any failure so the map can
/// just fall back to a straight line rather than breaking.
class RoutingService {
  Future<List<LatLng>> route(LatLng from, LatLng to) async {
    final url = Uri.parse(
      '${AppConstants.osrmBaseUrl}/route/v1/driving/'
      '${from.longitude},${from.latitude};${to.longitude},${to.latitude}'
      '?overview=full&geometries=geojson',
    );
    try {
      final resp = await http.get(url).timeout(const Duration(seconds: 8));
      if (resp.statusCode != 200) return [];
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final routes = data['routes'] as List<dynamic>?;
      if (routes == null || routes.isEmpty) return [];
      final coords = (routes.first['geometry']['coordinates'] as List<dynamic>);
      return coords
          .map((c) => LatLng((c as List<dynamic>)[1] as double, c[0] as double))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
