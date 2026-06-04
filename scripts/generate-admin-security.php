<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/security/helpers.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this script from the command line.\n");
    exit(1);
}

$username = $argv[1] ?? 'admin';
$password = $argv[2] ?? '';

if ($password === '') {
    fwrite(STDOUT, "Enter admin password: ");
    $password = trim((string) fgets(STDIN));
}

if (strlen($password) < 10) {
    fwrite(STDERR, "Use a password with at least 10 characters.\n");
    exit(1);
}

$secret = security_generate_random_base32(32);
$hash = password_hash($password, PASSWORD_DEFAULT);
$issuer = rawurlencode('SwaMedia Admin');
$account = rawurlencode($username);
$otpauth = "otpauth://totp/{$issuer}:{$account}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30";

fwrite(STDOUT, "Set these environment variables on the server:\n\n");
fwrite(STDOUT, "ADMIN_USERNAME={$username}\n");
fwrite(STDOUT, "ADMIN_PASSWORD_HASH={$hash}\n");
fwrite(STDOUT, "ADMIN_TOTP_SECRET={$secret}\n");
fwrite(STDOUT, "ADMIN_SESSION_TIMEOUT=1800\n");
fwrite(STDOUT, "FORCE_HTTPS=1\n\n");
fwrite(STDOUT, "Add this TOTP secret or URL to Google Authenticator/Authy/1Password:\n");
fwrite(STDOUT, "Secret: {$secret}\n");
fwrite(STDOUT, "otpauth URL: {$otpauth}\n");
