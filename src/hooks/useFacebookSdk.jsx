import { useState, useEffect } from 'react';

const FB_APP_ID = '1692465144990536';

export function useFacebookSdk() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If FB is already loaded
    if (window.FB) {
      setIsReady(true);
      return;
    }

    // Define window.fbAsyncInit before script loads
    window.fbAsyncInit = function() {
      try {
        window.FB.init({
          appId      : FB_APP_ID,
          cookie     : true,                     // Enable cookies to allow the server to access the session.
          xfbml      : true,                     // Parse social plugins on this webpage.
          version    : 'v19.0'                   // Use this Graph API version for this call.
        });
        setIsReady(true);
      } catch (err) {
        console.error("Facebook SDK init error", err);
        setError(err);
      }
    };

    // Load the Facebook script asynchronously
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));

  }, []);

  const login = () => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
         reject(new Error("Facebook SDK not loaded."));
         return;
      }
      
      window.FB.login(function(response) {
        if (response.authResponse) {
          resolve(response.authResponse); // contains accessToken, userID, etc.
        } else {
          reject(new Error("Login failed or cancelled by user."));
        }
      }, { scope: 'ads_read,leads_retrieval,pages_show_list,pages_manage_ads,public_profile' });
    });
  };

  const getLoginStatus = () => {
    return new Promise((resolve) => {
      if (!window.FB) resolve({ status: 'unknown' });
      window.FB.getLoginStatus(function(response) {
        resolve(response);
      });
    });
  };

  return { isReady, error, login, getLoginStatus };
}
