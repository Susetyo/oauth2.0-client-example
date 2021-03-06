var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser");

var querystring = require("querystring");
var request = require("superagent");

var port = process.env.PORT || 3000;

var authService = process.env.AUTH_SITE || "https://auth.brightspace.com";
var authCodeEndpoint = authService + "/oauth2/auth";
var tokenEndpoint = authService + "/core/connect/token";
var getRedirectUri = function (req) {
    return "https://" + req.headers.host + "/callback";
    // return req.protocol + "://" + req.headers.host + "/callback";
};
// var getRedirectUri = function (req) {
//     return "https://parkwaypantai.brightspace.com/d2l/home/7249";
// };

var cookieName = "application-data-api-demo",
    cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

require("ejs"); // to trigger 'serverless-plugin-include-dependencies'
app.set("view engine", "ejs");
app.enable("trust proxy");
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", function (req, res) {
    res.render("index");
});

app.get("/auth", function (req, res) {
    // Authorization Request: https://tools.ietf.org/html/rfc6749#section-4.1.1
    var authCodeParams = querystring.stringify({
        response_type: "code",
        redirect_uri: getRedirectUri(req),
        client_id: process.env.CLIENT_ID,
        scope: "core:*:*",
        // Generate a secure state in production to prevent CSRF (https://tools.ietf.org/html/rfc6749#section-10.12)
        state: "f4c269a0-4a69-43c1-9405-86209c896fa0",
    });

    res.redirect(authCodeEndpoint + "?" + authCodeParams);
});

app.get("/callback", function (req, res) {
    // Authorization Response: https://tools.ietf.org/html/rfc6749#section-4.1.2
    // Validate req.query.state before continuing in production to prevent CSRF (https://tools.ietf.org/html/rfc6749#section-10.12)
    var authorizationCode = req.query.code;

    // Access Token Request: https://tools.ietf.org/html/rfc6749#section-4.1.3
    var payload = {
        grant_type: "authorization_code",
        redirect_uri: getRedirectUri(req),
        code: authorizationCode,
    };

    request
        .post(tokenEndpoint)
        // Authenticate via HTTP Basic authentication scheme: https://tools.ietf.org/html/rfc6749#section-2.3.1
        .auth(process.env.CLIENT_ID, process.env.CLIENT_SECRET)
        // Using application/x-www-form-urlencoded as per https://tools.ietf.org/html/rfc6749#section-4.1.3
        .type("form")
        .send(payload)
        .end(function (err, postResponse) {
            if (err) {
                console.log("Access Token Error", err.response || err);
                res.redirect("/");
            } else {
                console.log("Hello");
                // Access Token Response: https://tools.ietf.org/html/rfc6749#section-4.1.4
                // We are storing the access token in a cookie for simplicity, but the user agent should never have to see it
                res.cookie(
                    cookieName,
                    { accessToken: postResponse.body.access_token },
                    cookieOptions
                );

                // Optionally, store the refresh token (postResponse.body.refresh_token) to a user context (https://tools.ietf.org/html/rfc6749#section-6)

                res.redirect("/data");
            }
        });
});

app.get("/data", function (req, res) {
    var access_token = req.cookies[cookieName].accessToken;

    console.log(access_token);

    request
        .get(process.env.HOST_URL + "/d2l/api/lp/1.10/users/whoami")
        .set("Authorization", `Bearer ${access_token}`)
        .end(function (error, response) {
            if (error) {
                var errorMessage = JSON.stringify(error, null, 2);
                console.log(errorMessage);
                res.send(`<pre>${errorMessage}</pre>`);
            } else {
                var locals = {
                    data: JSON.stringify(
                        JSON.parse(response.text || "{}"),
                        null,
                        2
                    ),
                };
                res.render("data", locals);
            }
        });
});

app.get("/userDetails", function (req, res) {
    var access_token = req.cookies[cookieName].accessToken;
    var userId = req.query.userId;

    request
        .get(process.env.HOST_URL + "/d2l/api/lp/1.23/users/" + userId)
        .set("Authorization", `Bearer ${access_token}`)
        .end(function (error, response) {
            if (error) {
                var errorMessage = JSON.stringify(error, null, 2);
                console.log(errorMessage);
                res.send(`<pre>${errorMessage}</pre>`);
            } else {
                var locals = {
                    data: JSON.stringify(
                        JSON.parse(response.text || "{}"),
                        null,
                        2
                    ),
                };
                res.render("userDetails", locals);
            }
        });
});

app.listen(port);
console.log(`HTTP started on port ${port}.`);

module.exports = app;
module.exports.handler = require("serverless-http")(app);
