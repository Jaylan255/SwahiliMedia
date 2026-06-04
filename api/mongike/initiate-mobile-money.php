<?php

declare(strict_types=1);

require_once dirname(dirname(__DIR__)) . '/security/bootstrap.php';

security_bootstrap(false);
security_rate_limit('mongike_initiate', 20, 300);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    security_json_response([
        'status' => 'error',
        'message' => 'Method not allowed'
    ], 405);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== 0) {
    security_log_event('mongike_bad_content_type', ['content_type' => $contentType]);
    security_json_response([
        'status' => 'error',
        'message' => 'Expected JSON request body.'
    ], 415);
}

$body = security_read_json_body();

$orderId = trim((string) ($body['order_id'] ?? ''));
$amount = $body['amount'] ?? '';
$buyerPhone = preg_replace('/\D+/', '', (string) ($body['buyer_phone'] ?? '')) ?? '';
$buyerName = trim((string) ($body['buyer_name'] ?? ''));
$buyerEmail = trim((string) ($body['buyer_email'] ?? ''));
$feePayer = strtoupper(trim((string) ($body['fee_payer'] ?? 'MERCHANT')));
$metadata = $body['metadata'] ?? [];

if ($orderId === '' || $amount === '' || $buyerPhone === '') {
    security_json_response([
        'status' => 'error',
        'message' => 'order_id, amount and buyer_phone are required.'
    ], 400);
}

if (!preg_match('/^[A-Za-z0-9._-]{4,64}$/', $orderId)) {
    security_json_response([
        'status' => 'error',
        'message' => 'Invalid order ID format.'
    ], 422);
}

if (!is_numeric((string) $amount) || (float) $amount <= 0) {
    security_json_response([
        'status' => 'error',
        'message' => 'Amount must be a positive number.'
    ], 422);
}

if (!preg_match('/^\d{9,15}$/', $buyerPhone)) {
    security_json_response([
        'status' => 'error',
        'message' => 'Invalid buyer phone number.'
    ], 422);
}

if ($buyerEmail !== '' && !filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
    security_json_response([
        'status' => 'error',
        'message' => 'Invalid buyer email address.'
    ], 422);
}

if (!in_array($feePayer, ['MERCHANT', 'CUSTOMER'], true)) {
    $feePayer = 'MERCHANT';
}

if (!is_array($metadata)) {
    $metadata = [];
}

$apiKey = getenv('MONGIKE_API_KEY');
if (!$apiKey) {
    security_log_event('mongike_missing_api_key');
    security_json_response([
        'status' => 'error',
        'message' => 'MONGIKE_API_KEY is missing on the server.'
    ], 500);
}

$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
);
$scheme = $isHttps ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '';
$webhookUrl = $host ? $scheme . '://' . $host . '/api/mongike/webhook.php' : null;

$payload = [
    'order_id' => $orderId,
    'amount' => $amount,
    'buyer_phone' => $buyerPhone,
    'buyer_name' => $buyerName,
    'buyer_email' => $buyerEmail,
    'fee_payer' => $feePayer,
    'metadata' => $metadata
];

if ($webhookUrl) {
    $payload['webhook_url'] = $webhookUrl;
}

$ch = curl_init('https://mongike.com/api/v1/payments/mobile-money/tanzania');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'x-api-key: ' . $apiKey,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 60
]);

$responseBody = curl_exec($ch);
$curlError = curl_error($ch);
$statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($responseBody === false) {
    security_log_event('mongike_upstream_curl_error', ['error' => $curlError]);
    security_json_response([
        'status' => 'error',
        'message' => 'Failed to initiate mobile money payment.'
    ], 500);
}

$decoded = json_decode($responseBody, true);
if (!is_array($decoded)) {
    $decoded = [
        'status' => $statusCode >= 200 && $statusCode < 300 ? 'success' : 'error',
        'message' => $responseBody ?: 'Unexpected Mongike response'
    ];
}

security_log_event('mongike_initiate_response', [
    'order_id' => $orderId,
    'status_code' => $statusCode,
    'status' => $decoded['status'] ?? '',
]);

http_response_code($statusCode > 0 ? $statusCode : 200);
echo json_encode($decoded, JSON_UNESCAPED_SLASHES);
