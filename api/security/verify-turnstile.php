<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/security/bootstrap.php';

security_bootstrap();
security_rate_limit('turnstile_verify', 30, 300);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    security_json_response([
        'success' => false,
        'message' => 'Method not allowed.',
    ], 405);
}

$secretKey = security_env('TURNSTILE_SECRET_KEY');
if (!$secretKey) {
    security_log_event('turnstile_secret_missing');
    security_json_response([
        'success' => false,
        'message' => 'Verification service is not configured.',
    ], 503);
}

$payload = security_read_json_body();
$token = trim((string) ($payload['token'] ?? ''));
$expectedAction = trim((string) ($payload['action'] ?? ''));

if ($token === '') {
    security_json_response([
        'success' => false,
        'message' => 'Missing verification token.',
    ], 422);
}

$requestBody = http_build_query([
    'secret' => $secretKey,
    'response' => $token,
    'remoteip' => security_client_ip(),
]);

$verifyResponse = null;

if (function_exists('curl_init')) {
    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 10,
    ]);
    $verifyResponse = curl_exec($ch);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $requestBody,
            'timeout' => 10,
        ],
    ]);
    $verifyResponse = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $context);
}

if (!is_string($verifyResponse) || $verifyResponse === '') {
    security_log_event('turnstile_verify_request_failed');
    security_json_response([
        'success' => false,
        'message' => 'Verification request failed.',
    ], 502);
}

$decoded = json_decode($verifyResponse, true);
if (!is_array($decoded)) {
    security_log_event('turnstile_verify_invalid_response');
    security_json_response([
        'success' => false,
        'message' => 'Invalid verification response.',
    ], 502);
}

$isValid = ($decoded['success'] ?? false) === true;
$receivedAction = trim((string) ($decoded['action'] ?? ''));
if ($isValid && $expectedAction !== '' && $receivedAction !== '' && !hash_equals($expectedAction, $receivedAction)) {
    $isValid = false;
}

if (!$isValid) {
    security_log_event('turnstile_verify_failed', [
        'action' => $expectedAction,
        'error_codes' => $decoded['error-codes'] ?? [],
    ]);
    security_json_response([
        'success' => false,
        'message' => 'Please verify that you are human.',
        'errorCodes' => $decoded['error-codes'] ?? [],
    ], 403);
}

security_json_response([
    'success' => true,
    'challengeTs' => $decoded['challenge_ts'] ?? null,
    'hostname' => $decoded['hostname'] ?? null,
]);
